// Server-side enforcement for the "Forgot something?" customer-facing order
// editor (app/api/public/orders/[token]/edit-items/route.ts): a customer on
// an already-confirmed (paid) order may change an existing product's
// delivery type and addon selections, but may NOT add/remove a product card,
// swap which product a card refers to, or change its quantity — that's the
// difference between "reconfigure what you already ordered" (safe to
// auto-price and auto-charge, since it's just picking among already-known
// catalog prices for items already in the order) and "add a new item"
// (deliberately still staff-mediated — see
// docs/homepage-ordering-roadmap.md §4's own "not yet done" note). This is
// the actual gate that makes the distinction real, not just a UI
// restriction the client-side editor happens to impose — a request replayed
// or hand-crafted straight against the API is checked the same way.

type ProductCardIdentity = {
  cardId: number;
  productId: string | null;
  amount: number;
};

export type OrderItemEditValidation = { ok: true } | { ok: false; reason: string };

export function validateOrderItemEdits(
  originalCards: ProductCardIdentity[],
  submittedCards: ProductCardIdentity[],
): OrderItemEditValidation {
  if (submittedCards.length !== originalCards.length) {
    return { ok: false, reason: "CARD_COUNT_CHANGED" };
  }

  const originalByCardId = new Map(originalCards.map((card) => [card.cardId, card]));

  for (const submitted of submittedCards) {
    const original = originalByCardId.get(submitted.cardId);
    if (!original) {
      return { ok: false, reason: "UNKNOWN_CARD" };
    }
    if (original.productId !== submitted.productId) {
      return { ok: false, reason: "PRODUCT_CHANGED" };
    }
    if (original.amount !== submitted.amount) {
      return { ok: false, reason: "QUANTITY_CHANGED" };
    }
  }

  return { ok: true };
}
