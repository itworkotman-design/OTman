import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { getAutomaticXtraDeliveryCardIds } from "@/lib/booking/pricing/sharedDeliveryLogic";
import { getProductDeliveryType } from "@/lib/products/deliveryTypes";

export type DeliveryOptionPreview = {
  price: number;
  subcontractorPrice: number;
  isExtra: boolean;
};

function toNumber(value: string | undefined) {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

// Previews what FIRST_STEP/INDOOR would cost on a given card, accounting
// for the cross-card "most expensive delivery across the whole order stays
// full price, every other card's gets the flat extra rate" rule
// (getAutomaticXtraDeliveryCardIds, shared with the dashboard's booking
// flow) — so the UI never shows a price other than what's actually
// charged.
//
// The "is this card the discounted one" verdict is decided ONCE per card,
// from the order's real current selections, not per button: a card either
// is the order's single most-expensive delivery (both its options shown at
// full price) or it isn't (both shown at the flat extra rate). Deciding it
// per button instead — "if this card had that type selected, would IT
// individually win?" — sounds equivalent but isn't: on a price tie against
// another card's real selection, the earlier card in the array wins that
// one comparison by index, so a losing card's *unselected* option could
// still show full price purely by coincidence of list position. Card A
// picking cheap doorstep while card B picks pricier carry-in should show
// card A's own (unselected) carry-in option as "extra" too, even if it
// happens to list the same price as card B's.
export function previewCardDeliveryOptions(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  cardId: number,
): { firstStep: DeliveryOptionPreview; indoor: DeliveryOptionPreview } {
  const card = cards.find((c) => c.cardId === cardId);
  const product = card ? catalogProducts.find((p) => p.id === card.productId) : undefined;
  const isCardExtra = getAutomaticXtraDeliveryCardIds(cards, catalogProducts).has(cardId);

  function previewFor(type: "FIRST_STEP" | "INDOOR"): DeliveryOptionPreview {
    const deliveryType = product ? getProductDeliveryType(product.deliveryTypes, type) : null;
    const standardPrice = toNumber(deliveryType?.price);
    const standardSubcontractorPrice = toNumber(deliveryType?.subcontractorPrice);
    const xtraPrice = toNumber(deliveryType?.xtraPrice);
    const xtraSubcontractorPrice = toNumber(deliveryType?.xtraSubcontractorPrice);

    return isCardExtra
      ? { price: xtraPrice, subcontractorPrice: xtraSubcontractorPrice, isExtra: true }
      : { price: standardPrice, subcontractorPrice: standardSubcontractorPrice, isExtra: false };
  }

  return { firstStep: previewFor("FIRST_STEP"), indoor: previewFor("INDOOR") };
}
