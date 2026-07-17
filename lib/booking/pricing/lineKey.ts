// Stable identifier for a single priced line within a product card, used to
// key manual "null this line" selections. Must be computed the same way on
// both sides that build line items independently from the same card fields:
// the live calculator (ProductCardLineItem, see fromProductCards.ts/engine.ts)
// and the persisted order items (BuiltOrderItem, see buildOrderItemsFromCards.ts).
// Prefer the option id (stable, unique) and fall back to the code (used by
// delivery-type/custom-price/auto-delivery lines, which have no option id).
export function computeLineKey(input: {
  optionId?: string | null;
  code?: string | null;
}): string | null {
  if (input.optionId) return `opt:${input.optionId}`;
  if (input.code) return `code:${input.code}`;
  return null;
}
