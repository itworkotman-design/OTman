import { describe, expect, it } from "vitest";
import {
  addAdjustmentLine,
  updateAdjustmentLine,
  removeAdjustmentLine,
  unlinkAdjustmentLines,
  adjustmentLinesForView,
  adjustmentLinesFromLegacy,
  parseAdjustmentLines,
  proportionalSubcontractorMinus,
  resolveOrderAdjustments,
  storedAdjustmentLines,
  sumAdjustmentLines,
  type AdjustmentLine,
} from "@/lib/booking/pricing/adjustmentLines";

const line = (overrides: Partial<AdjustmentLine>): AdjustmentLine => ({
  id: "a",
  kind: "discount",
  description: "",
  amount: 0,
  ...overrides,
});

describe("sumAdjustmentLines", () => {
  it("sums each kind into its legacy adjustment field", () => {
    const result = sumAdjustmentLines([
      line({ id: "1", kind: "discount", amount: 500 }),
      line({ id: "2", kind: "discount", amount: 250.5 }),
      line({ id: "3", kind: "extra", amount: 300 }),
      line({ id: "4", kind: "subcontractorMinus", amount: 200 }),
      line({ id: "5", kind: "subcontractorPlus", amount: 100 }),
      line({ id: "6", kind: "subcontractorPlus", amount: 50 }),
    ]);

    expect(result).toEqual({
      rabatt: "750.5",
      leggTil: "300",
      subcontractorMinus: "200",
      subcontractorPlus: "150",
    });
  });

  it("returns empty strings for kinds with no lines", () => {
    expect(sumAdjustmentLines([])).toEqual({
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
    });
  });
});

describe("parseAdjustmentLines", () => {
  it("keeps valid lines and drops malformed ones", () => {
    const result = parseAdjustmentLines([
      { id: "1", kind: "discount", description: "  Damaged box ", amount: 500 },
      { id: "2", kind: "bogus", description: "x", amount: 10 },
      { id: "3", kind: "extra", description: "Stairs", amount: "abc" },
      { id: "4", kind: "extra", description: "Zero", amount: 0 },
      "nope",
      { kind: "subcontractorPlus", description: "No id", amount: 75 },
    ]);

    expect(result).toEqual([
      { id: "1", kind: "discount", description: "Damaged box", amount: 500 },
      { id: expect.any(String), kind: "subcontractorPlus", description: "No id", amount: 75 },
    ]);
  });

  it("converts negative amounts to positive (the kind carries the sign)", () => {
    expect(parseAdjustmentLines([{ id: "1", kind: "discount", description: "", amount: -200 }])).toEqual([
      { id: "1", kind: "discount", description: "", amount: 200 },
    ]);
  });

  it("returns null for anything that is not an array", () => {
    expect(parseAdjustmentLines(undefined)).toBeNull();
    expect(parseAdjustmentLines(null)).toBeNull();
    expect(parseAdjustmentLines({})).toBeNull();
  });

  it("keeps the sourceId linking an auto partner minus to its discount", () => {
    expect(
      parseAdjustmentLines([{ id: "2", kind: "subcontractorMinus", description: "", amount: 50, sourceId: "1" }]),
    ).toEqual([{ id: "2", kind: "subcontractorMinus", description: "", amount: 50, sourceId: "1" }]);
  });
});

describe("adjustmentLinesFromLegacy", () => {
  it("turns each non-zero legacy field into one undescribed line", () => {
    expect(
      adjustmentLinesFromLegacy({ rabatt: "500", leggTil: "", subcontractorMinus: "120", subcontractorPlus: "0" }),
    ).toEqual([
      { id: "legacy-discount", kind: "discount", description: "", amount: 500 },
      { id: "legacy-subcontractorMinus", kind: "subcontractorMinus", description: "", amount: 120 },
    ]);
  });

  it("loads a negative legacy value as a line of the opposite kind, keeping the total", () => {
    // Real prod values: leggTil "-890" was used as a discount, subcontractorPlus
    // "-540" as a partner minus, subcontractorMinus "-900" as a partner plus.
    const lines = adjustmentLinesFromLegacy({ rabatt: "", leggTil: "-890", subcontractorMinus: "-900", subcontractorPlus: "-540" });
    expect(lines).toEqual([
      { id: "legacy-extra", kind: "discount", description: "", amount: 890 },
      { id: "legacy-subcontractorMinus", kind: "subcontractorPlus", description: "", amount: 900 },
      { id: "legacy-subcontractorPlus", kind: "subcontractorMinus", description: "", amount: 540 },
    ]);
    // Same net effect as the old fields: customer -890, partner +900 - 540.
    expect(sumAdjustmentLines(lines)).toEqual({ rabatt: "890", leggTil: "", subcontractorMinus: "540", subcontractorPlus: "900" });
  });

  it("treats unparseable legacy values like the old engine did (as 0)", () => {
    expect(adjustmentLinesFromLegacy({ leggTil: "5-90" })).toEqual([]);
  });

  it("returns no lines when every field is empty", () => {
    expect(adjustmentLinesFromLegacy({ rabatt: null, leggTil: null, subcontractorMinus: null, subcontractorPlus: null })).toEqual([]);
  });
});

describe("resolveOrderAdjustments", () => {
  const emptyFields = { rabatt: null, leggTil: null, subcontractorMinus: null, subcontractorPlus: null };

  it("derives the summed fields from submitted lines, ignoring submitted sums", () => {
    const result = resolveOrderAdjustments({
      submittedLines: [{ id: "1", kind: "discount", description: "A", amount: 100 }],
      fields: { ...emptyFields, rabatt: "999" },
      fieldsWereSubmitted: true,
      existingLines: null,
    });

    expect(result.fields).toEqual({ ...emptyFields, rabatt: "100" });
    expect(result.lines).toEqual([{ id: "1", kind: "discount", description: "A", amount: 100 }]);
  });

  it("keeps existing lines when nothing adjustment-related was submitted", () => {
    const existingLines = [line({ id: "x", kind: "extra", description: "Stairs", amount: 300 })];
    const result = resolveOrderAdjustments({
      submittedLines: undefined,
      fields: { ...emptyFields, leggTil: "300" },
      fieldsWereSubmitted: false,
      existingLines,
    });

    expect(result.lines).toBe(existingLines);
    expect(result.fields).toEqual({ ...emptyFields, leggTil: "300" });
  });

  it("falls back to one line per field when only the summed fields were submitted", () => {
    const result = resolveOrderAdjustments({
      submittedLines: undefined,
      fields: { ...emptyFields, rabatt: "250" },
      fieldsWereSubmitted: true,
      existingLines: [line({ id: "old", amount: 999 })],
    });

    expect(result.lines).toEqual([{ id: "legacy-discount", kind: "discount", description: "", amount: 250 }]);
    expect(result.fields).toEqual({ ...emptyFields, rabatt: "250" });
  });
});

describe("storedAdjustmentLines", () => {
  const stored = [
    line({ id: "1", kind: "discount", description: "A", amount: 300 }),
    line({ id: "2", kind: "discount", description: "B", amount: 200 }),
  ];

  it("uses the stored lines when they still add up to the stored fields", () => {
    expect(
      storedAdjustmentLines(stored, { rabatt: "500", leggTil: null, subcontractorMinus: "", subcontractorPlus: null }),
    ).toBe(stored);
  });

  it("falls back to legacy lines when another writer changed the fields (e.g. bulk clear)", () => {
    expect(
      storedAdjustmentLines(stored, { rabatt: null, leggTil: null, subcontractorMinus: null, subcontractorPlus: null }),
    ).toEqual([]);
  });

  it("falls back to legacy lines when there are no stored lines", () => {
    expect(storedAdjustmentLines(null, { rabatt: "100" })).toEqual([
      { id: "legacy-discount", kind: "discount", description: "", amount: 100 },
    ]);
  });
});

describe("addAdjustmentLine", () => {
  const ids = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  it("adds an empty discount line plus a linked partner minus line", () => {
    expect(addAdjustmentLine([], "discount", ids())).toEqual([
      { id: "id-1", kind: "discount", description: "", amount: 0 },
      { id: "id-2", kind: "subcontractorMinus", description: "", amount: 0, sourceId: "id-1" },
    ]);
  });

  it("adds a single empty line for the other kinds", () => {
    const existing = [line({ id: "x", kind: "extra", amount: 100 })];
    expect(addAdjustmentLine(existing, "subcontractorPlus", ids())).toEqual([
      ...existing,
      { id: "id-1", kind: "subcontractorPlus", description: "", amount: 0 },
    ]);
  });
});

describe("updateAdjustmentLine", () => {
  const totals = { subtotalExVat: 4000, subcontractorBase: 2000 };
  const linked = [
    line({ id: "d", kind: "discount", description: "", amount: 0 }),
    line({ id: "m", kind: "subcontractorMinus", description: "", amount: 0, sourceId: "d" }),
  ];

  it("recalculates the linked partner minus live as the discount amount changes", () => {
    const result = updateAdjustmentLine(linked, "d", { amount: 1000 }, totals);
    expect(result).toEqual([
      { id: "d", kind: "discount", description: "", amount: 1000 },
      { id: "m", kind: "subcontractorMinus", description: "", amount: 500, sourceId: "d" },
    ]);
  });

  it("copies the discount description to the linked partner minus", () => {
    const result = updateAdjustmentLine(linked, "d", { description: "Damaged box" }, totals);
    expect(result.map((l) => l.description)).toEqual(["Damaged box", "Damaged box"]);
  });

  it("unlinks a partner minus once its amount is edited by hand", () => {
    const edited = updateAdjustmentLine(linked, "m", { amount: 50 }, totals);
    expect(edited[1]).toEqual({ id: "m", kind: "subcontractorMinus", description: "", amount: 50 });

    const afterDiscount = updateAdjustmentLine(edited, "d", { amount: 1000 }, totals);
    expect(afterDiscount[1].amount).toBe(50);
  });

  it("leaves unrelated lines untouched", () => {
    const other = line({ id: "e", kind: "extra", amount: 300 });
    const result = updateAdjustmentLine([...linked, other], "d", { amount: 1000 }, totals);
    expect(result[2]).toBe(other);
  });
});

describe("linked partner minus uses totals including extras and partner plus", () => {
  // Real case: products 2918 (customer) / 1799 (partner), extra 82, partner
  // plus 201 → 3000 / 2000. A 1500 discount is 50%, so the partner minus is 1000.
  const totals = { subtotalExVat: 2918, subcontractorBase: 1799 };
  const base = [
    line({ id: "e", kind: "extra", amount: 82 }),
    line({ id: "p", kind: "subcontractorPlus", amount: 201 }),
    line({ id: "d", kind: "discount", amount: 0 }),
    line({ id: "m", kind: "subcontractorMinus", amount: 0, sourceId: "d" }),
  ];

  it("gives the partner the same percentage cut", () => {
    const result = updateAdjustmentLine(base, "d", { amount: 1500 }, totals);
    expect(result.find((l) => l.id === "m")?.amount).toBe(1000);
  });

  it("re-syncs the linked minus when an extra changes after the discount", () => {
    const discounted = updateAdjustmentLine(base, "d", { amount: 1500 }, totals);
    const result = updateAdjustmentLine(discounted, "e", { amount: 582 }, totals);
    // 1500 / 3500 of 2000 = 857
    expect(result.find((l) => l.id === "m")?.amount).toBe(857);
  });

  it("re-syncs the linked minus when a partner plus is removed", () => {
    const discounted = updateAdjustmentLine(base, "d", { amount: 1500 }, totals);
    const result = removeAdjustmentLine(discounted, "p", totals);
    // 50% of 1799 = 900
    expect(result.find((l) => l.id === "m")?.amount).toBe(900);
  });

  it("does not touch a partner minus that was edited by hand", () => {
    const manual = updateAdjustmentLine(updateAdjustmentLine(base, "d", { amount: 1500 }, totals), "m", { amount: 300 }, totals);
    const result = updateAdjustmentLine(manual, "e", { amount: 582 }, totals);
    expect(result.find((l) => l.id === "m")?.amount).toBe(300);
  });

  it("removes the linked minus together with its discount", () => {
    expect(removeAdjustmentLine(base, "d", totals).map((l) => l.id)).toEqual(["e", "p"]);
  });
});

describe("unlinkAdjustmentLines", () => {
  const totals = { subtotalExVat: 4000, subcontractorBase: 2000 };
  const linked = updateAdjustmentLine(
    [
      line({ id: "d", kind: "discount", amount: 0 }),
      line({ id: "m", kind: "subcontractorMinus", amount: 0, sourceId: "d" }),
    ],
    "d",
    { amount: 1000, description: "Damaged" },
    totals,
  );

  it("unlinks the partner minus of an applied discount, keeping its amount", () => {
    expect(unlinkAdjustmentLines(linked, "d")).toEqual([
      { id: "d", kind: "discount", description: "Damaged", amount: 1000 },
      { id: "m", kind: "subcontractorMinus", description: "Damaged", amount: 500 },
    ]);
  });

  it("after unlinking, editing the discount or an extra leaves the partner minus alone", () => {
    const applied = unlinkAdjustmentLines(linked, "d");
    const edited = updateAdjustmentLine(applied, "d", { amount: 200, description: "Other" }, totals);
    expect(edited[1]).toEqual({ id: "m", kind: "subcontractorMinus", description: "Damaged", amount: 500 });
  });

  it("after unlinking, removing the discount keeps the partner minus", () => {
    const applied = unlinkAdjustmentLines(linked, "d");
    expect(removeAdjustmentLine(applied, "d", totals).map((l) => l.id)).toEqual(["m"]);
  });

  it("unlinks every line when no id is given (saved orders load as applied)", () => {
    expect(unlinkAdjustmentLines(linked).some((l) => l.sourceId)).toBe(false);
  });

  it("returns the same array when nothing is linked", () => {
    const plain = [line({ id: "x", amount: 10 })];
    expect(unlinkAdjustmentLines(plain)).toBe(plain);
  });
});

describe("percentage lines", () => {
  const totals = { subtotalExVat: 2918, subcontractorBase: 1799 };
  const base = [
    line({ id: "e", kind: "extra", amount: 82 }),
    line({ id: "p", kind: "subcontractorPlus", amount: 201 }),
    line({ id: "d", kind: "discount", amount: 0 }),
    line({ id: "m", kind: "subcontractorMinus", amount: 0, sourceId: "d" }),
  ];
  const byId = (lines: AdjustmentLine[], id: string) => lines.find((l) => l.id === id);

  it("computes a discount from a percent of products + extras, and gives the partner the same %", () => {
    const result = updateAdjustmentLine(base, "d", { percent: 10 }, totals);
    expect(byId(result, "d")).toMatchObject({ amount: 300, percent: 10 });
    expect(byId(result, "m")?.amount).toBe(200);
  });

  it("computes a partner plus from partner products + other plus lines (excluding itself)", () => {
    const result = updateAdjustmentLine(base, "p", { percent: 10 }, totals);
    expect(byId(result, "p")).toMatchObject({ amount: 179.9, percent: 10 });
  });

  it("computes an extra from products + other extras (excluding itself)", () => {
    const withSecond = [...base, line({ id: "e2", kind: "extra", amount: 0 })];
    const result = updateAdjustmentLine(withSecond, "e2", { percent: 10 }, totals);
    expect(byId(result, "e2")?.amount).toBe(300);
  });

  it("caps subtracting kinds at 100%", () => {
    const result = updateAdjustmentLine(base, "d", { percent: 150 }, totals);
    expect(byId(result, "d")).toMatchObject({ amount: 3000, percent: 100 });
  });

  it("switching to percent converts the current amount into a percent", () => {
    const nok = updateAdjustmentLine(base, "d", { amount: 300 }, totals);
    expect(byId(updateAdjustmentLine(nok, "d", { unit: "percent" }, totals), "d")).toMatchObject({ amount: 300, percent: 10 });
  });

  it("switching back to NOK keeps the amount and drops the percent", () => {
    const pct = updateAdjustmentLine(base, "d", { percent: 10 }, totals);
    const back = byId(updateAdjustmentLine(pct, "d", { unit: "nok" }, totals), "d");
    expect(back?.amount).toBe(300);
    expect(back?.percent).toBeUndefined();
  });

  it("typing an amount on a percent line switches it back to a NOK line", () => {
    const pct = updateAdjustmentLine(base, "d", { percent: 10 }, totals);
    const typed = byId(updateAdjustmentLine(pct, "d", { amount: 450 }, totals), "d");
    expect(typed).toMatchObject({ amount: 450 });
    expect(typed?.percent).toBeUndefined();
  });

  it("takes the percent of the running total, after the other discounts/minus on that side", () => {
    // Real case: partner products 1799, an existing minus of 1256.96 → 542.04
    // left, so a further 10% minus is 54.20 (not 10% of 1799).
    const lines = [
      line({ id: "m1", kind: "subcontractorMinus", amount: 1256.96, percent: 69.87 }),
      line({ id: "m2", kind: "subcontractorMinus", amount: 0 }),
    ];
    const result = updateAdjustmentLine(lines, "m2", { percent: 10 }, { subtotalExVat: 2918, subcontractorBase: 1799 });
    expect(byId(result, "m2")?.amount).toBe(54.2);
  });

  it("a second customer discount % applies to the total after the first discount", () => {
    const first = updateAdjustmentLine(base, "d", { percent: 10 }, totals); // 300 of 3000
    const withSecond = [...unlinkAdjustmentLines(first), line({ id: "d2", kind: "discount", amount: 0 })];
    const result = updateAdjustmentLine(withSecond, "d2", { percent: 10 }, totals);
    expect(byId(result, "d2")?.amount).toBe(270);
  });

  it("a linked partner minus carries its discount's percent so partners see it", () => {
    const result = updateAdjustmentLine(base, "d", { percent: 25 }, totals);
    expect(byId(result, "m")).toMatchObject({ amount: 500, percent: 25 });
  });

  it("a linked partner minus of a NOK discount has no percent", () => {
    const pct = updateAdjustmentLine(base, "d", { percent: 25 }, totals);
    const nok = updateAdjustmentLine(pct, "d", { amount: 600 }, totals);
    const minus = byId(nok, "m");
    expect(minus?.amount).toBe(400);
    expect(minus?.percent).toBeUndefined();
  });

  it("parse keeps a valid percent", () => {
    expect(parseAdjustmentLines([{ id: "1", kind: "discount", description: "", amount: 300, percent: 10 }])).toEqual([
      { id: "1", kind: "discount", description: "", amount: 300, percent: 10 },
    ]);
  });
});

describe("adjustmentLinesForView", () => {
  const all = [
    line({ id: "d", kind: "discount", amount: 500 }),
    line({ id: "e", kind: "extra", amount: 20 }),
    line({ id: "m", kind: "subcontractorMinus", amount: 313 }),
    line({ id: "p", kind: "subcontractorPlus", amount: 50 }),
    line({ id: "z", kind: "discount", amount: 0 }),
  ];

  it("shows customers (and order creators) only discount and extra lines", () => {
    expect(adjustmentLinesForView(all, "customer").map((l) => l.id)).toEqual(["d", "e"]);
  });

  it("shows partners only their minus and plus lines, never the customer discount", () => {
    expect(adjustmentLinesForView(all, "partner").map((l) => l.id)).toEqual(["m", "p"]);
  });
});

describe("proportionalSubcontractorMinus", () => {
  it("scales the discount by the partner/customer subtotal ratio", () => {
    expect(proportionalSubcontractorMinus({ discount: 1000, subtotalExVat: 4000, subcontractorBase: 2000 })).toBe(500);
  });

  it("returns 0 when there is no customer subtotal", () => {
    expect(proportionalSubcontractorMinus({ discount: 1000, subtotalExVat: 0, subcontractorBase: 2000 })).toBe(0);
  });
});
