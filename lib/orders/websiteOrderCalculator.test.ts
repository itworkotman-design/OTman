import { describe, expect, it } from "vitest";
import type { CalculatorResult } from "@/lib/booking/pricing/types";
import {
  nulledLinesFromView,
  partnerMinusForDiscount,
  toggleNulledLine,
  websiteItemsSaveBody,
  websiteOrderCalculatorView,
} from "./websiteOrderCalculator";

const result: CalculatorResult = {
  breakdowns: [
    {
      productName: "Vaskemaskin",
      cardId: 0,
      lines: [
        { label: "Levering med innbæring", code: "INDOOR", qty: 1, unitPrice: 690, lineTotal: 690, subcontractorLineTotal: 300, lineKey: "code:INDOOR" },
        { label: "Retur", qty: 2, unitPrice: 130, lineTotal: 0, subcontractorLineTotal: 120, lineKey: "opt:ret", nulledForCustomer: true },
      ],
    },
    {
      productName: "Order extras",
      isOrderExtras: true,
      lines: [{ label: "Etasjetillegg", qty: 1, unitPrice: 200, lineTotal: 200, lineKey: "code:FLOOR" }],
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
          cardId: 0,
          lines: [
            { label: "Levering med innbæring", code: "INDOOR", qty: 1, customer: 690, partner: 300, lineKey: "code:INDOOR", nulledCustomer: false, nulledPartner: false },
            { label: "Retur", code: null, qty: 2, customer: 0, partner: 120, lineKey: "opt:ret", nulledCustomer: true, nulledPartner: false },
          ],
        },
        {
          name: "Order extras",
          isOrderExtras: true,
          cardId: null,
          lines: [{ label: "Etasjetillegg", code: null, qty: 1, customer: 200, partner: 0, lineKey: "code:FLOOR", nulledCustomer: false, nulledPartner: false }],
        },
      ],
      // Website prices already include VAT: `total` is what the customer pays.
      customer: { subtotal: 1150, discount: 100, extra: 50, total: 1100 },
      partner: { base: 420, minus: 37, plus: 10, total: 393 },
    });
  });

  it("doesn't count a line set to 0 again as a discount — the line already shows 0", () => {
    const nulled = { ...result, totals: { ...result.totals, discount: 0, checkboxDiscount: 260, subcontractorMinus: 0, subcontractorCheckboxDiscount: 120 } };
    const view = websiteOrderCalculatorView(nulled, { includePartner: true });
    expect(view.customer.discount).toBe(0);
    expect(view.partner?.minus).toBe(0);
  });

  it("leaves the partner side out for someone who can only view the order", () => {
    const view = websiteOrderCalculatorView(result, { includePartner: false });
    expect(view.partner).toBeNull();
    expect(view.products[0]!.lines[0]).toMatchObject({ label: "Levering med innbæring", customer: 690, partner: null, nulledPartner: false });
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

describe("websiteOrderCalculatorView — set to 0 choices", () => {
  it("collects the current choices per card and for the order extras, to send back on save", () => {
    expect(nulledLinesFromView(websiteOrderCalculatorView(result, { includePartner: true }))).toEqual({
      cards: { 0: { customer: ["opt:ret"], subcontractor: [] } },
      orderExtras: { customer: [], subcontractor: [] },
    });
  });
});

describe("toggleNulledLine — the booking app's checkbox rules", () => {
  const empty = { cards: {}, orderExtras: { customer: [], subcontractor: [] } };

  it("ticking the customer box also ticks the partner box", () => {
    const next = toggleNulledLine(empty, { cardId: 3 }, "customer", "opt:1", true);
    expect(next.cards[3]).toEqual({ customer: ["opt:1"], subcontractor: ["opt:1"] });
  });

  it("the partner box can be unticked on its own; the customer box stays", () => {
    const both = toggleNulledLine(empty, { cardId: 3 }, "customer", "opt:1", true);
    const next = toggleNulledLine(both, { cardId: 3 }, "partner", "opt:1", false);
    expect(next.cards[3]).toEqual({ customer: ["opt:1"], subcontractor: [] });
  });

  it("the partner box can be ticked without the customer box", () => {
    const next = toggleNulledLine(empty, { orderExtras: true }, "partner", "code:KM", true);
    expect(next.orderExtras).toEqual({ customer: [], subcontractor: ["code:KM"] });
  });

  it("unticking the customer box unticks the partner box too", () => {
    const both = toggleNulledLine(empty, { orderExtras: true }, "customer", "code:KM", true);
    const next = toggleNulledLine(both, { orderExtras: true }, "customer", "code:KM", false);
    expect(next.orderExtras).toEqual({ customer: [], subcontractor: [] });
  });
});

describe("websiteItemsSaveBody — one Save for the panel and the calculator", () => {
  const nulledLines = { cards: { 1: { customer: ["opt:2"], subcontractor: ["opt:2"] } }, orderExtras: { customer: [], subcontractor: [] } };

  it("sends only the panel fields when the calculator is unchanged", () => {
    expect(websiteItemsSaveBody({ driver: "Ola" }, null)).toEqual({ handling: { driver: "Ola" } });
  });

  it("adds the calculator amounts and the lines set to 0", () => {
    const draft = { adjustments: { rabatt: "500", leggTil: "", subcontractorMinus: "250", subcontractorPlus: "" }, nulledLines };
    expect(websiteItemsSaveBody({ driver: "Ola" }, draft, { dryRun: true })).toEqual({
      handling: { driver: "Ola", rabatt: "500", leggTil: "", subcontractorMinus: "250", subcontractorPlus: "" },
      nulledLines,
      dryRun: true,
    });
  });
});
