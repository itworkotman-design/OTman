import { describe, expect, it } from "vitest";
import { buildOrderAdjustmentLines, sortSummaryLines } from "./orderSummaryLines";

const line = (label: string, category: "delivery" | "install" | "other") => ({
  label,
  price: 0,
  qty: 1,
  category,
});

describe("sortSummaryLines", () => {
  it("puts delivery lines (main delivery, then extra delivery) above everything else", () => {
    const sorted = sortSummaryLines([
      line("Install", "install"),
      line("Unpacking", "other"),
      line("Delivery", "delivery"),
      line("Extra delivery", "delivery"),
    ]);
    expect(sorted.map((l) => l.label)).toEqual(["Delivery", "Extra delivery", "Install", "Unpacking"]);
  });

  it("keeps the original order within each group and doesn't mutate the input", () => {
    const input = [line("B", "other"), line("A", "other")];
    expect(sortSummaryLines(input).map((l) => l.label)).toEqual(["B", "A"]);
    expect(input.map((l) => l.label)).toEqual(["B", "A"]);
  });
});

describe("buildOrderAdjustmentLines", () => {
  it("shows a staff discount and extra charge, so the lines add up to the total", () => {
    expect(buildOrderAdjustmentLines({ discount: 500, extra: 200 }, "no")).toEqual([
      { label: "Rabatt", price: -500, qty: 1 },
      { label: "Tillegg", price: 200, qty: 1 },
    ]);
    expect(buildOrderAdjustmentLines({ discount: 500, extra: 0 }, "en")).toEqual([{ label: "Discount", price: -500, qty: 1 }]);
  });

  it("adds nothing without adjustments", () => {
    expect(buildOrderAdjustmentLines({ discount: 0, extra: 0 }, "no")).toEqual([]);
  });
});
