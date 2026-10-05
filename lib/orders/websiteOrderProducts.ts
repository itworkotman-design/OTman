import { parseNokAdjustment, roundNok, type OrderPricingSnapshot } from "./orderTotals";

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

// Sanity check of a website order's money, for the admin WebsiteOrderModal.
// The customer pays what they were shown, so any of these being non-zero
// means something is wrong and must be visible, not explained away:
// - missingFromLines: what the order total holds beyond its own priced lines
//   (+ booked order extras ± manual discount/surcharge) — lines missing or
//   mispriced (e.g. returns stored at 0 kr).
// - differsFromShown: order total − the total the customer was shown when
//   booking (only while the order hasn't been re-priced since).
export function checkWebsiteOrderTotals(params: {
  total: number;
  products: ProductGroup[];
  orderExtras: { price: number }[];
  rabatt: string | null | undefined;
  leggTil: string | null | undefined;
  shownTotal?: number | null;
}) {
  const linesTotal = roundNok(
    params.products.reduce((sum, product) => sum + product.total, 0) +
      params.orderExtras.reduce((sum, line) => sum + line.price, 0),
  );
  const explained = linesTotal - parseNokAdjustment(params.rabatt) + parseNokAdjustment(params.leggTil);
  const missing = roundNok(params.total - explained);
  const shownTotal = typeof params.shownTotal === "number" ? params.shownTotal : null;
  const differsFromShown = shownTotal === null ? 0 : roundNok(params.total - shownTotal);
  return {
    linesTotal,
    // Under a krone is rounding of the stored total.
    missingFromLines: Math.abs(missing) < 1 ? 0 : missing,
    shownTotal,
    differsFromShown: Math.abs(differsFromShown) < 0.5 ? 0 : differsFromShown,
  };
}
