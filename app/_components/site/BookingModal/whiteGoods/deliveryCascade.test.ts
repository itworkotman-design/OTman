import { describe, expect, it } from "vitest";
import {
  createEmptyProductCard,
  type CatalogOption,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { cardWithDeliveryType, cascadeFirstCardDelivery } from "./deliveryCascade";

// The first card of a price list sets the delivery type for the list's other
// cards — once, and only while none of those has been touched yet.

function option(id: string, code: string, category: string): CatalogOption {
  return {
    id,
    code,
    label: code,
    description: null,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  };
}

function product(id: string, code: string, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id,
    code,
    label: code,
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [],
    ...overrides,
  };
}

// A real white-goods code, so the seed knows OVEN_INT is its installation type.
const oven = product("oven", "WG_OVEN", { options: [option("oven-int", "OVEN_INT", "install"), option("oven-unpack", "UNPACKING", "extra")] });
const washer = product("washer", "WG_WASHING_MACHINE");
const doorstepOnly = product("pallet", "PP_PALLET", {
  deliveryTypes: createDefaultProductDeliveryTypes().map((dt) => (dt.key === "INDOOR" || dt.key === "INSTALL_ONLY" ? { ...dt, enabled: false } : dt)),
});
const list = [oven, washer, doorstepOnly];

const card = (cardId: number, productId: string, patch: Partial<SavedProductCard> = {}): SavedProductCard => ({
  ...createEmptyProductCard(cardId),
  productId,
  deliveryType: "FIRST_STEP",
  ...patch,
});

// The first card already switched (as the flow passes it), the rest untouched.
const switched = (next: SavedProductCard["deliveryType"]) => [
  card(0, "oven", { deliveryType: next }),
  card(1, "washer"),
  card(2, "pallet"),
];

const types = (cards: SavedProductCard[] | null) => cards?.map((c) => c.deliveryType) ?? null;

describe("cascadeFirstCardDelivery", () => {
  it("gives the list's other cards the first card's new delivery type", () => {
    const next = cascadeFirstCardDelivery({ cards: switched("INDOOR"), changedCardId: 0, listProducts: list, editedCardIds: [], locale: "no" });
    expect(types(next)).toEqual(["INDOOR", "INDOOR", "FIRST_STEP"]);
  });

  it("leaves a product that doesn't offer that delivery type as it is", () => {
    const next = cascadeFirstCardDelivery({ cards: switched("INDOOR"), changedCardId: 0, listProducts: list, editedCardIds: [], locale: "no" });
    expect(next?.[2]).toEqual(card(2, "pallet"));
  });

  it("does nothing when the change was on a card other than the list's first", () => {
    const cards = [card(0, "oven"), card(1, "washer", { deliveryType: "INDOOR" }), card(2, "pallet")];
    expect(cascadeFirstCardDelivery({ cards, changedCardId: 1, listProducts: list, editedCardIds: [], locale: "no" })).toBeNull();
  });

  it("does nothing once another card of the list has been edited", () => {
    expect(
      cascadeFirstCardDelivery({ cards: switched("INDOOR"), changedCardId: 0, listProducts: list, editedCardIds: [1], locale: "no" }),
    ).toBeNull();
  });

  it("isn't blocked by edits to the first card itself, or to another list's cards", () => {
    const next = cascadeFirstCardDelivery({ cards: switched("INDOOR"), changedCardId: 0, listProducts: list, editedCardIds: [0, 9], locale: "no" });
    expect(types(next)).toEqual(["INDOOR", "INDOOR", "FIRST_STEP"]);
  });

  it("only touches the list's own cards — another list's are left alone", () => {
    const cards = [...switched("INDOOR"), card(3, "sofa")];
    const next = cascadeFirstCardDelivery({ cards, changedCardId: 0, listProducts: list, editedCardIds: [], locale: "no" });
    expect(next?.[3]).toEqual(card(3, "sofa"));
  });

  it("the list's first card is the first in order, even if another list's card comes before it", () => {
    const cards = [card(3, "sofa"), ...switched("INDOOR")];
    const next = cascadeFirstCardDelivery({ cards, changedCardId: 0, listProducts: list, editedCardIds: [], locale: "no" });
    expect(types(next)).toEqual(["FIRST_STEP", "INDOOR", "INDOOR", "FIRST_STEP"]);
  });

  it("does nothing with no other card in the list", () => {
    const cards = [card(0, "oven", { deliveryType: "INDOOR" })];
    expect(cascadeFirstCardDelivery({ cards, changedCardId: 0, listProducts: list, editedCardIds: [], locale: "no" })).toBeNull();
  });

  it("cascades installation only too, starting each card with its first installation", () => {
    const cards = [card(1, "washer", { deliveryType: "INSTALL_ONLY" }), card(0, "oven")];
    const next = cascadeFirstCardDelivery({ cards, changedCardId: 1, listProducts: list, editedCardIds: [], locale: "no" });
    expect(next?.[1]).toMatchObject({ deliveryType: "INSTALL_ONLY", selectedInstallOptionIds: ["oven-int"] });
  });
});

describe("cardWithDeliveryType", () => {
  it("clears the add-ons, as picking a delivery type on the card does", () => {
    const before = card(0, "oven", {
      selectedInstallOptionIds: ["oven-int"],
      selectedExtraOptionIds: ["oven-unpack"],
      selectedReturnOptionId: "ret",
      demontEnabled: true,
    });
    expect(cardWithDeliveryType(before, oven, "INDOOR", "no")).toMatchObject({
      deliveryType: "INDOOR",
      selectedInstallOptionIds: [],
      selectedExtraOptionIds: [],
      selectedReturnOptionId: null,
      demontEnabled: false,
    });
  });

  it("keeps an item's size and weight (Other furniture)", () => {
    const sized = product("other", "FN_OTHER_FURNITURE", {
      options: [option("vol", "OF_VOL_SM", "size_volume"), option("unpack", "UNPACKING", "extra")],
    });
    const before = card(0, "other", { selectedExtraOptionIds: ["vol", "unpack"] });
    expect(cardWithDeliveryType(before, sized, "INDOOR", "no").selectedExtraOptionIds).toEqual(["vol"]);
  });
});
