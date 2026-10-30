import { describe, expect, it } from "vitest";
import { sanitizeAmountInput, trackNewAdjustmentLines } from "./adjustmentLineEditing";
import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";

const line = (id: string, amount: number, sourceId?: string): AdjustmentLine => ({
  id,
  kind: sourceId ? "subcontractorMinus" : "discount",
  description: "",
  amount,
  ...(sourceId ? { sourceId } : {}),
});

describe("sanitizeAmountInput", () => {
  it.each([
    ["1500", "1500"],
    ["15a0b", "150"],
    ["-200", "200"],
    ["1 500 kr", "1500"],
    ["12,5", "12,5"],
    ["12.50", "12.50"],
    ["12,555", "12,55"],
    ["1,2,3", "1,23"],
    ["1.2,3", "1.23"],
    [",5", "0,5"],
    ["", ""],
    ["abc", ""],
  ])("%j → %j", (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected);
  });
});

describe("trackNewAdjustmentLines", () => {
  it("returns null when every line is already known", () => {
    expect(trackNewAdjustmentLines([line("a", 100)], new Set(["a"]), new Set())).toBeNull();
  });

  it("opens a freshly added (empty) line for editing", () => {
    const result = trackNewAdjustmentLines([line("a", 100), line("b", 0)], new Set(["a"]), new Set());
    expect(result).toEqual({ knownIds: new Set(["a", "b"]), editingIds: new Set(["b"]) });
  });

  it("does not open a linked partner minus line, it follows its discount", () => {
    const result = trackNewAdjustmentLines([line("d", 0), line("m", 0, "d")], new Set(), new Set());
    expect(result?.editingIds).toEqual(new Set(["d"]));
  });

  it("does not open lines loaded from a saved order (non-zero amounts)", () => {
    const result = trackNewAdjustmentLines([line("a", 500)], new Set(), new Set());
    expect(result).toEqual({ knownIds: new Set(["a"]), editingIds: new Set() });
  });
});
