import { describe, expect, it } from "vitest";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { orderHasRequiredDelivery } from "./orderDeliveryRequirement";

describe("orderHasRequiredDelivery", () => {
  it("is true when at least one card picked doorstep delivery", () => {
    const cards = [
      { ...createEmptyProductCard(0), productId: "p1", deliveryType: "FIRST_STEP" as const },
    ];

    expect(orderHasRequiredDelivery(cards)).toBe(true);
  });

  it("is true when at least one card picked carry-in delivery", () => {
    const cards = [
      { ...createEmptyProductCard(0), productId: "p1", deliveryType: "INDOOR" as const },
    ];

    expect(orderHasRequiredDelivery(cards)).toBe(true);
  });

  it("is false when every card is installation-only", () => {
    const cards = [
      { ...createEmptyProductCard(0), productId: "p1", deliveryType: "INSTALL_ONLY" as const },
      { ...createEmptyProductCard(1), productId: "p2", deliveryType: "INSTALL_ONLY" as const },
    ];

    expect(orderHasRequiredDelivery(cards)).toBe(false);
  });

  it("is true when only one of several cards has real delivery and the rest are installation-only", () => {
    const cards = [
      { ...createEmptyProductCard(0), productId: "p1", deliveryType: "INSTALL_ONLY" as const },
      { ...createEmptyProductCard(1), productId: "p2", deliveryType: "INDOOR" as const },
    ];

    expect(orderHasRequiredDelivery(cards)).toBe(true);
  });

  it("is false when no cards have a delivery type chosen yet", () => {
    const cards = [{ ...createEmptyProductCard(0), productId: "p1", deliveryType: "" as const }];

    expect(orderHasRequiredDelivery(cards)).toBe(false);
  });

  it("is false for an empty order", () => {
    expect(orderHasRequiredDelivery([])).toBe(false);
  });

  it("ignores cards with no product selected yet", () => {
    const cards = [{ ...createEmptyProductCard(0), productId: null, deliveryType: "FIRST_STEP" as const }];

    expect(orderHasRequiredDelivery(cards)).toBe(false);
  });
});
