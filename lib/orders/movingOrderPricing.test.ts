import { describe, expect, it } from "vitest";
import { getOrderChargeAmountIncVatNok } from "./orderTotals";
import { movingOrderPricing } from "./movingOrderPricing";

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
});
