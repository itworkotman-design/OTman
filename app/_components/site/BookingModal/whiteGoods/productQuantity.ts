import {
  createEmptyProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";

// New cards are inserted next to their product's other cards (see
// addAnotherProductCard), so the last card is not necessarily the newest.
export function nextCardId(cards: SavedProductCard[]): number {
  return cards.reduce((max, card) => Math.max(max, card.cardId), -1) + 1;
}

// Total units per product across all of its cards — what the product grid's
// quantity stepper shows.
export function getProductQuantities(cards: SavedProductCard[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const card of cards) {
    if (card.productId) quantities[card.productId] = (quantities[card.productId] ?? 0) + card.amount;
  }
  return quantities;
}

// Every product defaults to doorstep delivery (cheapest, listed first) the
// moment it's added — never left blank — so an order can never be completed
// with a product silently missing a delivery charge because its own buttons
// were never touched. It also means the first product immediately establishes
// the order's "full price" delivery reference, so later products preview the
// correct extra rate right away instead of only once their own delivery
// buttons get clicked (see getAutomaticXtraDeliveryCardIds).
function newProductCard(cardId: number, productId: string, amount: number): SavedProductCard {
  return {
    ...createEmptyProductCard(cardId),
    productId,
    amount,
    deliveryType: DELIVERY_TYPES.FIRST_STEP,
  };
}

// Applies a quantity-stepper change from the product grid, where the number is
// the product's TOTAL units. A product normally has one card; when the
// customer has split it into several differently-configured cards (see
// addAnotherProductCard), extra units go on the first card and removed units
// come off the last one first, dropping cards that empty out. Zero/negative
// amounts remove the product's cards entirely rather than leaving a
// zero-quantity one around.
export function applyProductQuantity(
  cards: SavedProductCard[],
  productId: string,
  amount: number,
  newCardId: number,
): SavedProductCard[] {
  const clamped = Math.max(0, amount);
  const own = cards.filter((card) => card.productId === productId);

  if (clamped <= 0) {
    return own.length === 0 ? cards : cards.filter((card) => card.productId !== productId);
  }

  if (own.length === 0) return [...cards, newProductCard(newCardId, productId, clamped)];

  const current = own.reduce((sum, card) => sum + card.amount, 0);
  if (clamped === current) return cards;

  if (clamped > current) {
    const firstId = own[0].cardId;
    return cards.map((card) => (card.cardId === firstId ? { ...card, amount: card.amount + clamped - current } : card));
  }

  let toRemove = current - clamped;
  const amounts = new Map<number, number>();
  for (const card of [...own].reverse()) {
    const taken = Math.min(card.amount, toRemove);
    amounts.set(card.cardId, card.amount - taken);
    toRemove -= taken;
  }
  return cards
    .map((card) => (amounts.has(card.cardId) ? { ...card, amount: amounts.get(card.cardId) ?? card.amount } : card))
    .filter((card) => card.productId !== productId || card.amount > 0);
}

// "Add another": a second, independently configured card for a product already
// on the order (e.g. a bed for disposal and another bed for reuse). It starts
// blank — one unit, default delivery, no options — and sits right after that
// product's last card so the cards stay grouped.
export function addAnotherProductCard(
  cards: SavedProductCard[],
  productId: string,
  newCardId: number,
): SavedProductCard[] {
  const lastIndex = cards.map((card) => card.productId).lastIndexOf(productId);
  if (lastIndex === -1) return cards;

  return [...cards.slice(0, lastIndex + 1), newProductCard(newCardId, productId, 1), ...cards.slice(lastIndex + 1)];
}

export function removeProductCard(cards: SavedProductCard[], cardId: number): SavedProductCard[] {
  return cards.filter((card) => card.cardId !== cardId);
}
