import { describe, expect, it } from "vitest";
import type { CalculatorResult } from "@/lib/booking/pricing/types";
import { partnerMinusForDiscount, websiteOrderCalculatorView } from "./websiteOrderCalculator";

const result: CalculatorResult = {
  breakdowns: [
    {
      productName: "Vaskemaskin",
      cardId: 0,
      lines: [
        { label: "Levering med innbæring", code: "INDOOR", qty: 1, unitPrice: 690, lineTotal: 690, subcontractorLineTotal: 300 },
        { label: "Retur", qty: 2, unitPrice: 130, lineTotal: 260, subcontractorLineTotal: 120 },
      ],
    },
    {
      productName: "Order extras",
      isOrderExtras: true,
      lines: [{ label: "Etasjetillegg", qty: 1, unitPrice: 200, lineTotal: 200 }],
    },
  ],
  totals: {
    subtotalExVat: 1150,
    discount: 100,
    extra: 50,
    checkboxDiscount: 0,
    totalExVat: 1100,
    vat: 275,
    totalIncVat: 1375,
    subcontractorBase: 420,
    subcontractorMinus: 37,
    subcontractorPlus: 10,
    subcontractorCheckboxDiscount: 0,
    subcontractorTotal: 393,
  },
};

describe("websiteOrderCalculatorView", () => {
  it("lists every line with the customer's and the partner's price, and both totals", () => {
    expect(websiteOrderCalculatorView(result, { includePartner: true })).toEqual({
      products: [
        {
          name: "Vaskemaskin",
          isOrderExtras: false,
          lines: [
            { label: "Levering med innbæring", code: "INDOOR", qty: 1, customer: 690, partner: 300 },
            { label: "Retur", code: null, qty: 2, customer: 260, partner: 120 },
          ],
        },
        {
          name: "Order extras",
          isOrderExtras: true,
          lines: [{ label: "Etasjetillegg", code: null, qty: 1, customer: 200, partner: 0 }],
        },
      ],
      // Website prices already include VAT: `total` is what the customer pays.
      customer: { subtotal: 1150, discount: 100, extra: 50, total: 1100 },
      partner: { base: 420, minus: 37, plus: 10, total: 393 },
    });
  });

  it("leaves the partner side out for someone who can only view the order", () => {
    const view = websiteOrderCalculatorView(result, { includePartner: false });
    expect(view.partner).toBeNull();
    expect(view.products[0]!.lines[0]).toEqual({ label: "Levering med innbæring", code: "INDOOR", qty: 1, customer: 690, partner: null });
  });
});

describe("partnerMinusForDiscount", () => {
  it("cuts the partner's pay by the same share as the customer's discount, like the booking app", () => {
    // 100 off 1150 = 8.7 %; 8.7 % of the partner's 420 = 37.
    expect(partnerMinusForDiscount({ rabatt: "100", subtotal: 1150, partnerBase: 420 })).toBe("37");
    expect(partnerMinusForDiscount({ rabatt: "99,50", subtotal: 1000, partnerBase: 1000 })).toBe("100");
  });

  it("is empty when there's no discount or nothing to take it from", () => {
    expect(partnerMinusForDiscount({ rabatt: "", subtotal: 1150, partnerBase: 420 })).toBe("");
    expect(partnerMinusForDiscount({ rabatt: "100", subtotal: 0, partnerBase: 420 })).toBe("");
  });
});
