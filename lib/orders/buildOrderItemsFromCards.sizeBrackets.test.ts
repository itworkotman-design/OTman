import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { buildOrderItemsFromCards } from "./buildOrderItemsFromCards";

function option(id: string, code: string, category: string, customer: string, subcontractor: string) {
  return {
    id,
    code,
    label: code,
    description: code,
    category,
    customerPrice: customer,
    subcontractorPrice: subcontractor,
    effectiveCustomerPrice: customer,
    active: true,
  };
}

// Extras are OFF on this product, like "Other furniture" — the size brackets
// must still become order items.
const product: CatalogProduct = {
  id: "other-furniture",
  code: "FN_OTHER_FURNITURE",
  label: "Other furniture",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: false,
  allowReturnOptions: false,
  allowExtraServices: false,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: false,
  autoXtraPerPallet: false,
  deliveryTypes: createDefaultProductDeliveryTypes(),
  customSections: [],
  options: [
    option("vol-small", "OF_VOL_1", "size_volume", "100", "40"),
    option("vol-big", "OF_VOL_2", "size_volume", "400", "160"),
    option("wt-light", "OF_WT_1", "size_weight", "150", "60"),
    option("wt-heavy", "OF_WT_2", "size_weight", "300", "120"),
  ],
};

function card(overrides: Partial<SavedProductCard>): SavedProductCard {
  return {
    cardId: 0,
    productId: "other-furniture",
    modelNumber: "",
    deliveryType: DELIVERY_TYPES.FIRST_STEP,
    amount: 1,
    peopleCount: 1,
    hoursInput: 1,
    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    selectedReturnOptionId: null,
    demontEnabled: false,
    selectedTimeOptionIds: [],
    extraTimeHours: 0.5,
    extraPalletEnabled: false,
    extraPalletQty: 1,
    etterEnabled: false,
    etterQty: 1,
    customSectionSelections: [],
    ...overrides,
  };
}

function sizeItems(cards: SavedProductCard[]) {
  return buildOrderItemsFromCards(cards, [product], []).filter((i) => i.optionCode?.startsWith("OF_"));
}

describe("size brackets in the stored order items", () => {
  it("keeps both brackets on the order but prices only the pricier one (weight wins)", () => {
    const items = sizeItems([card({ selectedExtraOptionIds: ["vol-small", "wt-heavy"] })]);

    expect(items.map((i) => [i.optionCode, i.customerPriceCents, i.subcontractorPriceCents])).toEqual([
      ["OF_VOL_1", 0, 0],
      ["OF_WT_2", 30000, 12000],
    ]);
  });

  it("prices the volume bracket when it is pricier", () => {
    const items = sizeItems([card({ selectedExtraOptionIds: ["vol-big", "wt-light"] })]);

    expect(items.map((i) => [i.optionCode, i.customerPriceCents])).toEqual([
      ["OF_VOL_2", 40000],
      ["OF_WT_1", 0],
    ]);
  });

  it("agrees with the totals engine's choice and carries the quantity", () => {
    const items = sizeItems([card({ amount: 2, selectedExtraOptionIds: ["vol-big", "wt-light"] })]);

    expect(items.every((i) => i.quantity === 2)).toBe(true);
    expect(items.find((i) => i.optionCode === "OF_VOL_2")?.customerPriceCents).toBe(40000);
  });

  it("records them as extra options on the card's product", () => {
    const [first] = sizeItems([card({ selectedExtraOptionIds: ["vol-big"] })]);

    expect(first).toMatchObject({ itemType: "EXTRA_OPTION", productCode: "FN_OTHER_FURNITURE", optionId: "vol-big" });
  });
});
