import type { OrderSummaryExtraLine, OrderSummaryLine } from "./WhiteGoodsOrderSummary";

// Delivery lines (the main delivery, then any extra-delivery line) go on top
// of a product's lines; everything else keeps its original order below them.
export function sortSummaryLines(lines: OrderSummaryLine[]): OrderSummaryLine[] {
  const delivery = lines.filter((line) => line.category === "delivery");
  const rest = lines.filter((line) => line.category !== "delivery");
  return [...delivery, ...rest];
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
