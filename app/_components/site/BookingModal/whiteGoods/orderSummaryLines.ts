import type { OrderSummaryLine } from "./WhiteGoodsOrderSummary";

// Delivery lines (the main delivery, then any extra-delivery line) go on top
// of a product's lines; everything else keeps its original order below them.
export function sortSummaryLines(lines: OrderSummaryLine[]): OrderSummaryLine[] {
  const delivery = lines.filter((line) => line.category === "delivery");
  const rest = lines.filter((line) => line.category !== "delivery");
  return [...delivery, ...rest];
}
