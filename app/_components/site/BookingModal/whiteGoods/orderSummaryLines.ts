import type { OrderSummaryExtraLine, OrderSummaryLine } from "./WhiteGoodsOrderSummary";
import { isSizeBracketCategory } from "@/lib/booking/pricing/sizeBrackets";

// Delivery lines (the main delivery, then any extra-delivery line) go on top
// of a product's lines; everything else keeps its original order below them.
export function sortSummaryLines(lines: OrderSummaryLine[]): OrderSummaryLine[] {
  const delivery = lines.filter((line) => line.category === "delivery");
  const rest = lines.filter((line) => line.category !== "delivery");
  return [...delivery, ...rest];
}

// Other furniture's volume / weight choices ("Opptil 4 m³", "Over 50 kg") are
// priced 0 — the size only picks the delivery price — so the calculator leaves
// them out. One staff have priced is a real charge and stays. The stored order
// lines keep them all (staff and drivers need the size and weight).
export function dropFreeSizeBracketLines<T extends { code?: string | null; lineTotal: number }>(
  lines: T[],
  product: { options: Array<{ code: string; category: string | null }> },
): T[] {
  return lines.filter((line) => {
    const option = product.options.find((o) => o.code === line.code);
    return !(option && isSizeBracketCategory(option.category) && line.lineTotal === 0);
  });
}

// Staff-set discount / extra charge on the order (rabatt / leggTil), shown as
// order-level lines so the summary's lines add up to its total.
export function buildOrderAdjustmentLines(
  totals: { discount: number; extra: number },
  locale: "no" | "en",
): OrderSummaryExtraLine[] {
  const lines: OrderSummaryExtraLine[] = [];
  if (totals.discount > 0) lines.push({ label: locale === "no" ? "Rabatt" : "Discount", price: -totals.discount, qty: 1 });
  if (totals.extra > 0) lines.push({ label: locale === "no" ? "Tillegg" : "Extra charge", price: totals.extra, qty: 1 });
  return lines;
}
