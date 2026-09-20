import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { isTransportDeliveryType } from "@/lib/booking/pricing/sharedDeliveryLogic";

// Business rule: a customer can mark other products "installation only" (no
// delivery charge — they already have the item), but the order as a whole
// still needs at least one product actually being delivered (doorstep or
// carry-in) — otherwise there'd be nothing for us to bring out.
export function orderHasRequiredDelivery(cards: SavedProductCard[]): boolean {
  return cards.some((card) => !!card.productId && isTransportDeliveryType(card.deliveryType));
}
