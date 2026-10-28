import { describe, expect, it } from "vitest";
import { renderAdjustmentRowsHtml } from "./adjustmentRowsHtml";
import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";

const lines: AdjustmentLine[] = [
  { id: "d", kind: "discount", description: "Damaged pallet", amount: 500 },
  { id: "e", kind: "extra", description: "snuss <package>", amount: 20 },
  { id: "d2", kind: "discount", description: "DNB", amount: 380, percent: 25 },
  { id: "m", kind: "subcontractorMinus", description: "Damaged pallet", amount: 313 },
  { id: "p", kind: "subcontractorPlus", description: "", amount: 50 },
];

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("renderAdjustmentRowsHtml", () => {
  it("renders the customer's discount and extra rows with descriptions, percent and signed amounts", () => {
    const html = renderAdjustmentRowsHtml(lines, "customer");
    expect(text(html)).toBe(
      "Rabatt – Damaged pallet -500,00 NOK Ekstra – snuss &lt;package&gt; +20,00 NOK Rabatt – DNB (25 %) -380,00 NOK",
    );
  });

  it("escapes descriptions", () => {
    expect(renderAdjustmentRowsHtml(lines, "customer")).toContain("snuss &lt;package&gt;");
  });

  it("renders only the partner's own minus and plus rows for partners", () => {
    expect(text(renderAdjustmentRowsHtml(lines, "partner"))).toBe("Minus – Damaged pallet -313,00 NOK Pluss +50,00 NOK");
  });

  it("renders nothing when there are no lines for the view", () => {
    expect(renderAdjustmentRowsHtml([], "customer")).toBe("");
  });
});
