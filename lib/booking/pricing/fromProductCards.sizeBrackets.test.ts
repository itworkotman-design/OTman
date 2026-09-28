import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

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

// Mirrors "Other furniture": extras are OFF for the product's delivery type,
// so this also proves the size brackets are priced independently of the
// extras gate.
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

function priceCard(cards: SavedProductCard[]) {
  const result = calculateBookingPricing({
    productBreakdowns: buildProductBreakdowns(cards, [product], []),
    priceLookup: buildPriceLookup([product], []),
  });
  const lines = result.breakdowns.flatMap((b) => b.lines);
  const sizeLines = lines.filter((l) => l.code?.startsWith("OF_"));
  return { result, lines, sizeLines };
}

describe("size brackets in the product-card pricing engine", () => {
  it("charges the weight bracket when it is pricier than the volume bracket, and waives the volume one", () => {
    const { sizeLines } = priceCard([card({ selectedExtraOptionIds: ["vol-small", "wt-heavy"] })]);

    expect(sizeLines.map((l) => [l.code, l.lineTotal])).toEqual([
      ["OF_VOL_1", 0],
      ["OF_WT_2", 300],
    ]);
  });

  it("charges the volume bracket when it is pricier, and waives the weight one", () => {
    const { sizeLines } = priceCard([card({ selectedExtraOptionIds: ["vol-big", "wt-light"] })]);

    expect(sizeLines.map((l) => [l.code, l.lineTotal])).toEqual([
      ["OF_VOL_2", 400],
      ["OF_WT_1", 0],
    ]);
  });

  it("adds the size charge on top of the delivery price instead of replacing it", () => {
    const withoutSize = priceCard([card({})]).result.totals.totalExVat;
    const withSize = priceCard([card({ selectedExtraOptionIds: ["vol-big", "wt-light"] })]).result.totals.totalExVat;

    expect(withSize - withoutSize).toBe(400);
  });

  it("waives the lesser bracket for the subcontractor total too — only the chargeable bracket's subcontractor price counts", () => {
    const withoutSize = priceCard([card({})]).result.totals.subcontractorTotal;
    const withSize = priceCard([card({ selectedExtraOptionIds: ["vol-small", "wt-heavy"] })]).result.totals.subcontractorTotal;

    expect(withSize - withoutSize).toBe(120);
  });

  it("multiplies the charge by the quantity", () => {
    const { sizeLines } = priceCard([card({ amount: 3, selectedExtraOptionIds: ["vol-big", "wt-light"] })]);

    expect(sizeLines.find((l) => l.code === "OF_VOL_2")?.lineTotal).toBe(1200);
  });

  it("charges a lone bracket normally when only one category was chosen", () => {
    const { sizeLines } = priceCard([card({ selectedExtraOptionIds: ["wt-light"] })]);

    expect(sizeLines.map((l) => [l.code, l.lineTotal])).toEqual([["OF_WT_1", 150]]);
  });
});
