import { describe, expect, it } from "vitest";
import { sortSummaryLines } from "./orderSummaryLines";

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
