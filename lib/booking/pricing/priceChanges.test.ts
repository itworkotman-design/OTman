import { describe, expect, it } from "vitest";
import type { CalculatedBreakdown, CalculatorResult } from "./types";
import { diffCalculatorRows } from "./priceChanges";

const totals = {
  subtotalExVat: 0,
  discount: 0,
  extra: 0,
  checkboxDiscount: 0,
  totalExVat: 0,
  vat: 0,
  totalIncVat: 0,
  subcontractorBase: 0,
  subcontractorMinus: 0,
  subcontractorPlus: 0,
  subcontractorCheckboxDiscount: 0,
  subcontractorTotal: 0,
};
const result = (breakdowns: CalculatedBreakdown[]): CalculatorResult => ({ breakdowns, totals });
const row = (label: string, lineTotal: number, subcontractorLineTotal: number, code = label) => ({
  label,
  code,
  qty: 1,
  unitPrice: lineTotal,
  lineTotal,
  subcontractorLineTotal,
});

describe("diffCalculatorRows", () => {
  it("names each row whose customer or partner price moved, with both prices", () => {
    const saved = result([
      { productName: "Washing machine", cardId: 0, lines: [row("Install – approved wet room", 1220, 600), row("Return", 520, 200)] },
    ]);
    const now = result([
      { productName: "Washing machine", cardId: 0, lines: [row("Install – approved wet room", 1230, 600), row("Return", 520, 250)] },
    ]);
    expect(diffCalculatorRows(saved, now)).toEqual([
      { productName: "Washing machine", label: "Install – approved wet room", saved: 1220, now: 1230, savedPartner: 600, nowPartner: 600 },
      { productName: "Washing machine", label: "Return", saved: 520, now: 520, savedPartner: 200, nowPartner: 250 },
    ]);
  });

  it("gives order-level rows (km, floors, pickups) without a product", () => {
    const km = (price: number) => result([{ productName: "Order extras", isOrderExtras: true, lines: [row("Per km", price, 100)] }]);
    expect(diffCalculatorRows(km(2520), km(2604))).toEqual([
      { productName: null, label: "Per km", saved: 2520, now: 2604, savedPartner: 100, nowPartner: 100 },
    ]);
  });

  it("counts a row on only one side as 0 on the other", () => {
    const saved = result([{ productName: "Tumble dryer", cardId: 1, lines: [] }]);
    const now = result([{ productName: "Tumble dryer", cardId: 1, lines: [row("Extra item", 235, 125, "XTRA")] }]);
    expect(diffCalculatorRows(saved, now)).toEqual([
      { productName: "Tumble dryer", label: "Extra item", saved: 0, now: 235, savedPartner: 0, nowPartner: 125 },
    ]);
  });

  it("tells two cards of the same product apart", () => {
    const two = (second: number) =>
      result([
        { productName: "Tumble dryer", cardId: 1, lines: [row("Unpacking", 106, 50)] },
        { productName: "Tumble dryer", cardId: 2, lines: [row("Unpacking", second, 50)] },
      ]);
    expect(diffCalculatorRows(two(106), two(110))).toHaveLength(1);
  });

  it("is empty when nothing moved", () => {
    const same = result([{ productName: "Sofa", cardId: 0, lines: [row("Carry-in", 690, 465)] }]);
    expect(diffCalculatorRows(same, same)).toEqual([]);
  });
});
