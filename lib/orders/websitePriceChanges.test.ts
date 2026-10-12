import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { OrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";
import { findMissingSnapshotPrices } from "./websitePriceChanges";

describe("findMissingSnapshotPrices", () => {
  const card = (cardId: number, overrides: Partial<SavedProductCard> = {}): SavedProductCard => ({
    ...createEmptyProductCard(cardId),
    productId: "p-wm",
    deliveryType: "INDOOR",
    ...overrides,
  });
  const snapshot = (overrides: Partial<OrderPricingSnapshot> = {}) =>
    ({
      productOptions: { install: { customerPrice: "610", subcontractorPrice: "300", effectiveCustomerPrice: "610" } },
      specialOptions: { ret: { customerPrice: "260", subcontractorPrice: "100", effectiveCustomerPrice: "260" } },
      deliveryTypes: { "p-wm:INDOOR": { price: "690", xtraPrice: "235" } },
      autoDeliveryPrices: {},
      customSectionOptions: {},
      priceListSettings: {},
      ...overrides,
    }) as unknown as OrderPricingSnapshot;

  it("passes cards whose delivery type and options all have a saved price", () => {
    const cards = [card(0, { selectedInstallOptionIds: ["install"], selectedReturnOptionId: "ret" })];
    expect(findMissingSnapshotPrices(cards, snapshot())).toEqual([]);
  });

  it("flags a card whose delivery type has no saved price (the missing carry-in case)", () => {
    expect(findMissingSnapshotPrices([card(0), card(1, { productId: "p-dryer" })], snapshot())).toEqual([1]);
  });

  it("flags a card with a selected option that has no saved price", () => {
    expect(findMissingSnapshotPrices([card(0, { selectedExtraOptionIds: ["unpack"] })], snapshot())).toEqual([0]);
  });

  it("ignores cards without a product or delivery type yet", () => {
    expect(findMissingSnapshotPrices([card(0, { productId: null }), card(1, { deliveryType: "" })], snapshot())).toEqual([]);
  });
});
