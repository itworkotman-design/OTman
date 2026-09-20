import {
  createEmptyProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";

// Applies a quantity-stepper change from the product grid to the flat
// productCards list: at most one card per product (unlike the dashboard's
// booking flow, which allows several differently-configured cards for the
// same product). Zero/negative amounts remove the card entirely rather than
// leaving a zero-quantity one around.
export function applyProductQuantity(
  cards: SavedProductCard[],
  productId: string,
  amount: number,
  newCardId: number,
): SavedProductCard[] {
  const clamped = Math.max(0, amount);
  const index = cards.findIndex((card) => card.productId === productId);

  if (clamped <= 0) {
    if (index === -1) return cards;
    return cards.filter((_, i) => i !== index);
  }

  if (index === -1) {
    // Every product defaults to doorstep delivery (cheapest, listed first)
    // the moment it's added — never left blank — so an order can never be
    // completed with a product silently missing a delivery charge because
    // its own buttons were never touched. It also means the first product
    // immediately establishes the order's "full price" delivery reference,
    // so later products preview the correct extra rate right away instead
    // of only once their own delivery buttons get clicked (see
    // getAutomaticXtraDeliveryCardIds).
    return [
      ...cards,
      {
        ...createEmptyProductCard(newCardId),
        productId,
        amount: clamped,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      },
    ];
  }

  return cards.map((card, i) => (i === index ? { ...card, amount: clamped } : card));
}
