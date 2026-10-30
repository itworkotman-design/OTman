import {
  adjustmentLinesForView,
  type AdjustmentLine,
  type AdjustmentLineKind,
} from "@/lib/booking/pricing/adjustmentLines";

// Norwegian labels, matching the rest of the printed order PDF.
const PDF_LABELS: Record<AdjustmentLineKind, string> = {
  discount: "Rabatt",
  extra: "Ekstra",
  subcontractorMinus: "Minus",
  subcontractorPlus: "Pluss",
};

const SUBTRACTING_KINDS: AdjustmentLineKind[] = ["discount", "subcontractorMinus"];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(amount: number) {
  return amount.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Discount/extra (customer) or minus/plus (partner) rows for the order PDF,
// rendered with the PDF's existing `.priceRow` styling above the totals.
export function renderAdjustmentRowsHtml(lines: AdjustmentLine[], view: "customer" | "partner"): string {
  return adjustmentLinesForView(lines, view)
    .map((line) => {
      const sign = SUBTRACTING_KINDS.includes(line.kind) ? "-" : "+";
      const description = line.description ? ` – ${escapeHtml(line.description)}` : "";
      const percent = line.percent !== undefined ? ` (${String(line.percent).replace(".", ",")} %)` : "";
      return `
        <div class="priceRow">
          <div>${PDF_LABELS[line.kind]}${description}${percent}</div>
          <strong>${sign}${formatAmount(line.amount)} NOK</strong>
        </div>
      `;
    })
    .join("");
}
