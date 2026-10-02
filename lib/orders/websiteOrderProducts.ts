import type { OrderPricingSnapshot } from "./orderTotals";

// Turns a website order's stored pricing lines (Order.pricingSnapshot.lines,
// one row per product card and per chosen option) into one group per product
// card for the admin WebsiteOrderModal: the product's name, its priced lines
// and their total.

export type PricingLine = OrderPricingSnapshot["lines"][number];

export type ProductGroupItem = { label: string; qty: number; price: number };
export type ProductGroup = { cardId: number; productName: string; total: number; items: ProductGroupItem[] };

export function groupPricingLinesByCard(lines: PricingLine[]): ProductGroup[] {
  const groups = new Map<number, ProductGroup>();
  for (const line of lines) {
    let group = groups.get(line.cardId);
    if (!group) {
      group = { cardId: line.cardId, productName: line.productName, total: 0, items: [] };
      groups.set(line.cardId, group);
    }
    const price = line.customerLineTotal ?? 0;
    // The bare product-card row only matters when it carries a price itself.
    if (line.itemType === "PRODUCT_CARD" && !price) continue;
    group.items.push({
      label: line.itemType === "PRODUCT_CARD" ? line.productName : line.optionLabel || line.optionCode,
      qty: line.quantity,
      price,
    });
    group.total += price;
  }
  return [...groups.values()];
}

// Reads the lines out of Order.pricingSnapshot (stored JSON), keeping only
// well-formed rows; [] for anything else.
export function pricingLinesFromSnapshot(snapshot: unknown): PricingLine[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const lines = (snapshot as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  return lines.filter(
    (line): line is PricingLine =>
      !!line &&
      typeof line === "object" &&
      typeof (line as PricingLine).cardId === "number" &&
      typeof (line as PricingLine).productName === "string",
  );
}

// What the order total holds beyond its product lines and the booked order
// extras — non-zero once the order was re-priced or adjusted after booking
// (e.g. a floor or address change), shown as its own line so the lines always
// add up to the total. Whole kroner: the stored total is rounded.
export function unexplainedPriceDifference(
  clientTotal: number,
  products: ProductGroup[],
  orderExtras: { price: number }[],
): number {
  const explained =
    products.reduce((sum, product) => sum + product.total, 0) + orderExtras.reduce((sum, line) => sum + line.price, 0);
  const difference = clientTotal - explained;
  // Under a krone is just the stored total being rounded.
  return Math.abs(difference) < 1 ? 0 : Math.round(difference);
}
