import { describe, expect, it } from "vitest";
import { serviceOrderAdjustedPricing, serviceOrderCalculatorView } from "./serviceOrderCalculator";

const NO_ADJUSTMENTS = { rabatt: null, leggTil: null, subcontractorMinus: null, subcontractorPlus: null };

const row = (productCode: string, optionCode: string, optionLabel: string, customerPriceCents: number, subcontractorPriceCents: number) => ({
  cardId: 0,
  productCode,
  productName: productCode,
  itemType: "product",
  optionCode,
  optionLabel,
  quantity: 1,
  customerPriceCents,
  subcontractorPriceCents,
});

const quote = row("SERVICE_QUOTE", "QUOTE:option-1", "Electrician", 400000, 250000);
const express = row("MOVING_EXPRESS", "EXPRESS_DELIVERY", "Express delivery", 150000, 80000);

describe("serviceOrderCalculatorView (a service order in the admin calculator)", () => {
  it("shows the quote as the service and express/deviation as order extras", () => {
    const view = serviceOrderCalculatorView([quote, express], NO_ADJUSTMENTS, { includePartner: true });
    expect(view.products.map((p) => [p.name, p.isOrderExtras, p.lines.map((l) => l.label)])).toEqual([
      ["Service", false, ["Electrician"]],
      ["Order extras", true, ["Express delivery"]],
    ]);
    expect(view.products[0].lines[0]).toMatchObject({ customer: 4000, partner: 2500, lineKey: "SERVICE_QUOTE:QUOTE:option-1" });
    expect(view.customer).toMatchObject({ subtotal: 5500, total: 5500, totalIncVat: 6875 });
    expect(view.partner).toMatchObject({ base: 3300, total: 3300 });
  });

  it("is empty — 0 kr — before the order is quoted", () => {
    const view = serviceOrderCalculatorView([], NO_ADJUSTMENTS, { includePartner: true });
    expect(view.products).toEqual([]);
    expect(view.customer.total).toBe(0);
  });

  it("applies the discount/extra, partner minus/plus and lines set to 0", () => {
    const view = serviceOrderCalculatorView(
      [quote, express],
      { rabatt: "500", leggTil: "100", subcontractorMinus: "300", subcontractorPlus: "50", nulledLines: { customer: ["MOVING_EXPRESS:EXPRESS_DELIVERY"], subcontractor: [] } },
      { includePartner: true },
    );
    expect(view.customer).toMatchObject({ subtotal: 4000, discount: 500, extra: 100, total: 3600 });
    expect(view.partner).toMatchObject({ base: 3300, total: 3050 });
  });

  it("hides the partner side when asked", () => {
    expect(serviceOrderCalculatorView([quote], NO_ADJUSTMENTS, { includePartner: false }).partner).toBeNull();
  });
});

describe("serviceOrderAdjustedPricing (what a service order stores)", () => {
  it("stores the calculator's totals", () => {
    const pricing = serviceOrderAdjustedPricing([quote, express], { ...NO_ADJUSTMENTS, rabatt: "500" });
    expect(pricing.priceExVat).toBe(5000);
    expect(pricing.priceSubcontractor).toBe(3300);
  });

  it("keeps the lines set to 0 on the snapshot", () => {
    const nulledLines = { customer: ["SERVICE_QUOTE:QUOTE:option-1"], subcontractor: [] };
    const pricing = serviceOrderAdjustedPricing([quote], { ...NO_ADJUSTMENTS, nulledLines });
    expect(pricing.priceExVat).toBe(0);
    expect((pricing.pricingSnapshot as Record<string, unknown>).movingNulledLines).toEqual(nulledLines);
  });
});
