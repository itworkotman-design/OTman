import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { validateWebsiteOrderCards } from "./validateWebsiteOrderCards";

function option(id: string, category: string, code = id.toUpperCase()) {
  return {
    id,
    code,
    label: id,
    description: id,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  };
}

const products = [
  {
    id: "other-furniture",
    code: "FN_OTHER_FURNITURE",
    label: "Other furniture",
    active: true,
    options: [
      option("vol-1", "size_volume", "OF_VOL_1"),
      option("vol-3", "size_volume", "OF_VOL_3"),
      option("wt-1", "size_weight", "OF_WT_1"),
    ],
  },
  { id: "wm", code: "WM", label: "Washing machine", active: true, options: [] },
  {
    id: "tv",
    code: "WG_TV",
    label: "TV",
    active: true,
    options: [option("tv-stand", "install", "TV_MOUNT_STAND_75_100")],
  },
  {
    id: "fridge",
    code: "WG_FRIDGE_FREEZER",
    label: "Fridge",
    active: true,
    options: [
      option("fridge-fs", "install", "FRIDGE_FREEZER_FS"),
      option("fridge-int", "install", "FRIDGE_FREEZER_INT_NOFP"),
      option("fridge-fp", "install", "FRIDGE_FREEZER_INT_FP"),
    ],
  },
] as unknown as CatalogProduct[];

function card(overrides: Partial<SavedProductCard> & Record<string, unknown> = {}): SavedProductCard {
  return {
    cardId: 0,
    productId: "wm",
    deliveryType: "firstStep",
    amount: 1,
    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    modelNumber: "",
    ...overrides,
  } as unknown as SavedProductCard;
}

describe("validateWebsiteOrderCards", () => {
  it("accepts a plain product", () => {
    const result = validateWebsiteOrderCards([card()], products);
    expect(result.ok).toBe(true);
  });

  it("refuses a product that isn't sold on the website", () => {
    expect(validateWebsiteOrderCards([card({ productId: "nope" })], products)).toEqual({ ok: false, reason: "UNKNOWN_PRODUCT" });
  });

  it("refuses a size-priced card without both brackets", () => {
    const result = validateWebsiteOrderCards(
      [card({ productId: "other-furniture", modelNumber: "Clock", selectedExtraOptionIds: [] })],
      products,
    );
    expect(result).toEqual({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" });
  });

  it("refuses a size-priced card without a name, and trims the name it keeps", () => {
    const base = { productId: "other-furniture", sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 }, selectedExtraOptionIds: ["wt-1"] };
    expect(validateWebsiteOrderCards([card({ ...base, modelNumber: "  " })], products)).toEqual({
      ok: false,
      reason: "ITEM_NAME_REQUIRED",
    });
    expect(validateWebsiteOrderCards([card({ ...base, modelNumber: "<b>x</b>" })], products)).toEqual({
      ok: false,
      reason: "ITEM_NAME_REQUIRED",
    });
    const ok = validateWebsiteOrderCards([card({ ...base, modelNumber: "  Clock  " })], products);
    expect(ok.ok && ok.cards[0].modelNumber).toBe("Clock");
  });

  it("refuses the integrated front panel with a freestanding fridge-freezer", () => {
    const fridgeCard = (ids: string[]) => card({ productId: "fridge", deliveryType: "INDOOR", selectedInstallOptionIds: ids });
    expect(validateWebsiteOrderCards([fridgeCard(["fridge-fs", "fridge-fp"])], products)).toEqual({
      ok: false,
      reason: "INSTALL_ADDON_NOT_ALLOWED",
    });
    expect(validateWebsiteOrderCards([fridgeCard(["fridge-int", "fridge-fp"])], products).ok).toBe(true);
  });

  it("accepts a TV on a stand on its own (its own install type, not an add-on)", () => {
    const tvCard = card({ productId: "tv", deliveryType: "INDOOR", selectedInstallOptionIds: ["tv-stand"] });
    expect(validateWebsiteOrderCards([tvCard], products).ok).toBe(true);
  });

  it("lets an order keep a combination it already had (booked before the rule), but not add it", () => {
    const fridgeCard = (cardId: number, ids: string[]) =>
      card({ cardId, productId: "fridge", deliveryType: "INDOOR", selectedInstallOptionIds: ids });
    const before = [fridgeCard(1, ["fridge-fs", "fridge-fp"]), fridgeCard(2, ["fridge-fs"])];

    // Card 1 unchanged (order of ids doesn't matter) — fine.
    expect(validateWebsiteOrderCards([fridgeCard(1, ["fridge-fp", "fridge-fs"])], products, { previousCards: before }).ok).toBe(true);
    // Card 2 newly gets the front panel — refused.
    expect(validateWebsiteOrderCards([fridgeCard(2, ["fridge-fs", "fridge-fp"])], products, { previousCards: before })).toEqual({
      ok: false,
      reason: "INSTALL_ADDON_NOT_ALLOWED",
    });
  });
});
