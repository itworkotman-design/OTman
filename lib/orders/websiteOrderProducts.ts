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
