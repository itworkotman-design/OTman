import { describe, expect, it } from "vitest";
import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";
import { readSubmittedAdjustmentLines, withAdjustmentLines } from "./websiteOrderAdjustmentLines";

const lines: AdjustmentLine[] = [
  { id: "d1", kind: "discount", description: "Damaged box", amount: 100 },
  { id: "d2", kind: "discount", description: "", amount: 50, percent: 5 },
  { id: "m1", kind: "subcontractorMinus", description: "", amount: 37, sourceId: "d1" },
  { id: "p1", kind: "subcontractorPlus", description: "Waiting time", amount: 200 },
];

describe("readSubmittedAdjustmentLines", () => {
  it("leaves a body without lines alone (older callers send only the four fields)", () => {
    expect(readSubmittedAdjustmentLines({ handling: { rabatt: "100" } })).toEqual({
      ok: true,
      lines: null,
      handling: { rabatt: "100" },
    });
    expect(readSubmittedAdjustmentLines(null)).toEqual({ ok: true, lines: null, handling: undefined });
  });

  it("lays the lines' per-kind sums over the handling fields, so they can never disagree", () => {
    const result = readSubmittedAdjustmentLines({
      handling: { driver: "Per", rabatt: "999" },
      adjustmentLines: lines,
    });
    expect(result).toEqual({
      ok: true,
      lines,
      handling: { driver: "Per", rabatt: "150", leggTil: "", subcontractorMinus: "37", subcontractorPlus: "200" },
    });
  });

  it("works without any handling (the calculator alone)", () => {
    const result = readSubmittedAdjustmentLines({ adjustmentLines: [] });
    expect(result).toEqual({
      ok: true,
      lines: [],
      handling: { rabatt: "", leggTil: "", subcontractorMinus: "", subcontractorPlus: "" },
    });
  });

  it("rejects lines that aren't a list", () => {
    expect(readSubmittedAdjustmentLines({ adjustmentLines: "nope" })).toEqual({ ok: false });
  });
});

describe("withAdjustmentLines", () => {
  it("stores the lines on the pricing snapshot, keeping the rest", () => {
    expect(withAdjustmentLines({ customer: { totalExVat: 900 } }, lines)).toEqual({
      customer: { totalExVat: 900 },
      adjustmentLines: lines,
    });
  });

  it("starts a snapshot when there is none", () => {
    expect(withAdjustmentLines(null, [])).toEqual({ adjustmentLines: [] });
  });
});
