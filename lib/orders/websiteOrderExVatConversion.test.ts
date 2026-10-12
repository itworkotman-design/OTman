import { describe, expect, it } from "vitest";
import { getOrderChargeAmountIncVatNok } from "./orderTotals";
import { convertWebsiteOrderToExVat } from "./websiteOrderExVatConversion";

// A website order from before the switch: every customer price stored incl.
// VAT (what the customer saw and paid).
function oldOrder(overrides: Record<string, unknown> = {}) {
  return {
    websiteOrderKind: "WHITE_GOODS",
    priceExVat: 13675,
    priceSubcontractor: 6785,
    rabatt: "125",
    leggTil: null,
    pricingSnapshot: {
      version: 1,
      customer: { subtotalExVat: 13800, discount: 125, extra: 0, totalExVat: 13675, vat: 3418.75, totalIncVat: 17093.75 },
      subcontractor: { subtotal: 6785, minus: 0, plus: 0, total: 6785 },
      customDeviationPrice: 250,
      lines: [{ cardId: 2, optionLabel: "Install", customerUnitPrice: 455, customerLineTotal: 455, subcontractorUnitPrice: 205, subcontractorLineTotal: 205 }],
    },
    websiteBookingDetails: { version: 1, shownTotal: 13675, orderExtras: [{ label: "Per km", price: 4740, qty: 158 }] },
    productCardsSnapshot: [{ cardId: 2, productId: "p", pricingSnapshot: { productOptions: { x: { customerPrice: "455" } } } }],
    items: [
      { id: "i1", customerPriceCents: 45500 },
      { id: "i2", customerPriceCents: null },
    ],
    ...overrides,
  };
}

describe("convertWebsiteOrderToExVat", () => {
  it("divides every customer price by 1.25 and keeps what the customer pays as the total incl. VAT", () => {
    const result = convertWebsiteOrderToExVat(oldOrder());
    if (result.skip) throw new Error(result.skip);

    expect(result.order.priceExVat).toBe(10940);
    expect(result.order.priceSubcontractor).toBeUndefined();
    expect(result.order.rabatt).toBe("100");
    expect(result.order.pricingSnapshot).toMatchObject({
      vatBasis: "exVat",
      customer: { subtotalExVat: 11040, discount: 100, extra: 0, totalExVat: 10940, vat: 2735, totalIncVat: 13675 },
      subcontractor: { total: 6785 },
      customDeviationPrice: 200,
      lines: [{ customerUnitPrice: 364, customerLineTotal: 364, subcontractorUnitPrice: 205 }],
    });
    expect(result.order.websiteBookingDetails).toMatchObject({ shownTotal: 13675, orderExtras: [{ label: "Per km", price: 3792, qty: 158 }] });
    expect(result.items).toEqual([{ id: "i1", customerPriceCents: 36400 }]);
    expect(result.inexact).toEqual([]);
  });

  it("drops the cards' saved catalog prices (they were incl. VAT)", () => {
    const result = convertWebsiteOrderToExVat(oldOrder());
    if (result.skip) throw new Error(result.skip);
    expect((result.order.productCardsSnapshot as { pricingSnapshot: unknown }[])[0].pricingSnapshot).toBeNull();
  });

  it("charges the customer exactly what they were charged before", () => {
    const before = oldOrder();
    const result = convertWebsiteOrderToExVat(before);
    if (result.skip) throw new Error(result.skip);
    const oldCharge = before.pricingSnapshot.customer.totalExVat;
    expect(getOrderChargeAmountIncVatNok({ ...before, ...result.order })).toBe(oldCharge);
  });

  it("reports amounts that don't divide evenly", () => {
    const result = convertWebsiteOrderToExVat(oldOrder({ items: [{ id: "i1", customerPriceCents: 45600 }] }));
    if (result.skip) throw new Error(result.skip);
    expect(result.items).toEqual([{ id: "i1", customerPriceCents: 36480 }]);
    expect(convertWebsiteOrderToExVat(oldOrder({ priceExVat: 13676 }))).toMatchObject({ inexact: expect.arrayContaining(["priceExVat"]) });
  });

  it("skips an order already priced ex. VAT, and anything that isn't a homepage order", () => {
    const converted = oldOrder({ pricingSnapshot: { ...oldOrder().pricingSnapshot, vatBasis: "exVat" } });
    expect(convertWebsiteOrderToExVat(converted)).toEqual({ skip: "ALREADY_EX_VAT" });
    expect(convertWebsiteOrderToExVat(oldOrder({ websiteOrderKind: null }))).toEqual({ skip: "NOT_A_WEBSITE_ORDER" });
  });
});
