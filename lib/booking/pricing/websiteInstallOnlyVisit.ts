import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { getAutomaticXtraDeliveryCardIds } from "@/lib/booking/pricing/sharedDeliveryLogic";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";
import { getProductDeliveryTypeCode, getProductDeliveryTypePrice } from "@/lib/products/deliveryTypes";

// Website flow only. "Installation/assembly only" is still a trip out to the
// customer, with its own price (Product.deliveryTypes INSTALL_ONLY — seeded as
// the carry-in price, see websiteDeliveryTypes.ts) and a 0 extra rate. With
// the shared pricing's installOnlyVisitPricing option it competes for the
// order's one full-price slot like any delivery (highest wins, ties go to the
// earlier card): as the full-price card it pays its price, as an extra card
// it's free, and a delivery it outprices drops to its extra rate. The shared
// pricing does all of that; this file only adds what the website shows.

function findProduct(card: SavedProductCard, catalogProducts: CatalogProduct[]) {
  return catalogProducts.find((p) => p.id === card.productId && p.active) ?? null;
}

// Free install-only lines on extra cards come out of the shared pricing coded
// as XTRA ("extra delivery"); keep the install-only code so the summary knows
// to show them blank instead of "Included".
export function applyWebsiteInstallOnlyVisit(
  breakdowns: ProductBreakdown[],
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): ProductBreakdown[] {
  return breakdowns.map((breakdown) => {
    const card = cards.find((c) => c.cardId === breakdown.cardId);
    if (!card || card.deliveryType !== DELIVERY_TYPES.INSTALL_ONLY) return breakdown;
    const product = findProduct(card, catalogProducts);
    if (!product) return breakdown;

    const code = getProductDeliveryTypeCode(product.deliveryTypes, DELIVERY_TYPES.INSTALL_ONLY);
    return {
      ...breakdown,
      items: breakdown.items.map((item) => (item.kind === "deliveryType" ? { ...item, code } : item)),
    };
  });
}

// The "installation only" option's price on this card: its install-only price
// on the order's full-price card, null (shown as nothing) on extra cards.
// Decided from the order's current selections, same as the doorstep/carry-in
// tiles (see deliveryPricePreview.ts).
export function previewInstallOnlyVisitPrice(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  cardId: number,
): number | null {
  const card = cards.find((c) => c.cardId === cardId);
  const product = card ? findProduct(card, catalogProducts) : null;
  if (!product || !product.allowDeliveryTypes) return null;
  if (getAutomaticXtraDeliveryCardIds(cards, catalogProducts, { installOnlyVisitPricing: true }).has(cardId)) {
    return null;
  }

  const price = getProductDeliveryTypePrice({ deliveryTypes: product.deliveryTypes, key: DELIVERY_TYPES.INSTALL_ONLY });
  return price > 0 ? price : null;
}
