import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { deliveryTypeSnapshotKey, type OrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";

// Whether a website order's saved catalog prices are complete. (Its prices
// against today's catalog, row by row, are lib/booking/pricing/priceChanges.ts.)

// Cards whose saved catalog prices (the snapshot stored on the cards) lack
// their delivery type or a selected option. Pricing such a card with them
// would quietly leave that charge out, so it's flagged instead.
export function findMissingSnapshotPrices(cards: SavedProductCard[], snapshot: OrderPricingSnapshot): number[] {
  return cards
    .filter((card) => {
      if (!card.productId || !card.deliveryType) return false;
      if (!snapshot.deliveryTypes?.[deliveryTypeSnapshotKey(card.productId, card.deliveryType)]) return true;
      const optionIds = [
        ...card.selectedInstallOptionIds,
        ...card.selectedExtraOptionIds,
        ...card.selectedTimeOptionIds,
        ...(card.selectedReturnOptionId ? [card.selectedReturnOptionId] : []),
      ];
      return optionIds.some((id) => !snapshot.productOptions?.[id] && !snapshot.specialOptions?.[id]);
    })
    .map((card) => card.cardId);
}
