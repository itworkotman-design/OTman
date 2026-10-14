import { describe, expect, it } from "vitest";
import { getOrderChargeAmountIncVatNok } from "./orderTotals";
import { movingCarrySurchargeLines, movingCustomerTotals, movingFloorSurchargeLines, movingOrderPricing } from "./movingOrderPricing";

// The moving price list holds prices ex. VAT, like every website price list:
// the customer pays the size bracket's price + 25%, rounded to whole kroner.
describe("movingOrderPricing", () => {
  const size = { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", customerPriceCents: 499000, subcontractorPriceCents: 300000 };

  it("stores the price ex. VAT and what the customer pays incl. VAT", () => {
    const pricing = movingOrderPricing(size);
    expect(pricing.priceExVat).toBe(4990);
    expect(pricing.priceSubcontractor).toBe(3000);
    expect(pricing.pricingSnapshot.customer).toMatchObject({ totalExVat: 4990, totalIncVat: 6238 });
    expect(pricing.pricingSnapshot.vatBasis).toBe("exVat");
  });

  it("charges exactly what the customer was shown", () => {
    const pricing = movingOrderPricing(size);
    expect(getOrderChargeAmountIncVatNok({ ...pricing, rabatt: null, leggTil: null, websiteOrderKind: null })).toBe(6238);
  });

  describe("with additional services", () => {
    const services = [
      { code: "SERVICE_NEDPAKKING", labelEn: "Packing", customerPriceCents: 99900, subcontractorPriceCents: 60000 },
      { code: "SERVICE_FLYTTEVASK", labelEn: "Move-out cleaning", customerPriceCents: 249900, subcontractorPriceCents: 150000 },
    ];

    it("adds each service to the ex. VAT and subcontractor totals", () => {
      const pricing = movingOrderPricing(size, services);
      expect(pricing.priceExVat).toBe(4990 + 999 + 2499);
      expect(pricing.priceSubcontractor).toBe(3000 + 600 + 1500);
    });

    it("rounds VAT per line, like every website order", () => {
      // 4990 → 6238 (6237.5), 999 → 1249 (1248.75), 2499 → 3124 (3123.75)
      const pricing = movingOrderPricing(size, services);
      expect(pricing.pricingSnapshot.customer).toMatchObject({ totalIncVat: 6238 + 1249 + 3124 });
      expect(getOrderChargeAmountIncVatNok({ ...pricing, rabatt: null, leggTil: null, websiteOrderKind: null })).toBe(
        6238 + 1249 + 3124,
      );
    });
  });
});

describe("movingCustomerTotals", () => {
  it("matches what movingOrderPricing charges, so the flow shows the real total", () => {
    const lines = [{ customerPriceCents: 499000 }, { customerPriceCents: 99900 }];
    expect(movingCustomerTotals(lines)).toEqual({ totalExVat: 5989, totalIncVat: 6238 + 1249 });
  });

  it("is zero for no lines", () => {
    expect(movingCustomerTotals([])).toEqual({ totalExVat: 0, totalIncVat: 0 });
  });
});

describe("movingFloorSurchargeLines", () => {
  const perFloor = { code: "FLOOR_SURCHARGE_PER_FLOOR", labelEn: "Floor surcharge", customerPriceCents: 30000, subcontractorPriceCents: 20000 };

  it("makes one line per end with chargeable floors, priced per floor", () => {
    const lines = movingFloorSurchargeLines(perFloor, [
      { label: "moving from", chargeableFloors: 2 },
      { label: "moving to", chargeableFloors: 0 },
    ]);
    expect(lines).toEqual([
      {
        code: "FLOOR_SURCHARGE_PER_FLOOR",
        labelEn: "Floor surcharge, moving from (2 floors)",
        quantity: 2,
        customerPriceCents: 60000,
        subcontractorPriceCents: 40000,
      },
    ]);
  });

  it("charges nothing when the surcharge isn't in the price list", () => {
    expect(movingFloorSurchargeLines(null, [{ label: "moving from", chargeableFloors: 3 }])).toEqual([]);
  });

  it("adds to the total with VAT rounded on the line, like every website line", () => {
    const size = { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", customerPriceCents: 499000, subcontractorPriceCents: 300000 };
    const lines = movingFloorSurchargeLines({ ...perFloor, customerPriceCents: 29900 }, [{ label: "moving from", chargeableFloors: 3 }]);
    // 4990 → 6238, 3 × 299 = 897 → 1121 (1121.25)
    expect(movingOrderPricing(size, lines).pricingSnapshot.customer).toMatchObject({ totalExVat: 4990 + 897, totalIncVat: 6238 + 1121 });
  });
});

describe("movingCarrySurchargeLines", () => {
  const surcharges = [
    { code: "CARRY_WITHIN_50M", labelEn: "Carrying distance: within 50 m", customerPriceCents: 50000, subcontractorPriceCents: 30000 },
    { code: "CARRY_FURTHER", labelEn: "Carrying distance: further away", customerPriceCents: 150000, subcontractorPriceCents: 90000 },
  ];

  it("charges each end by its parking answer; right outside is free", () => {
    expect(
      movingCarrySurchargeLines(surcharges, [
        { label: "moving from", parking: "FURTHER" },
        { label: "moving to", parking: "OUTSIDE" },
      ]),
    ).toEqual([
      {
        code: "CARRY_FURTHER",
        labelEn: "Carrying distance: further away, moving from",
        quantity: 1,
        customerPriceCents: 150000,
        subcontractorPriceCents: 90000,
      },
    ]);
  });

  it("skips an unanswered end or a surcharge missing from the price list", () => {
    expect(movingCarrySurchargeLines(surcharges, [{ label: "moving from", parking: null }])).toEqual([]);
    expect(movingCarrySurchargeLines([], [{ label: "moving from", parking: "WITHIN_50M" }])).toEqual([]);
  });
});
