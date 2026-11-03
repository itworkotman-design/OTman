import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { isSizeBracketCategory } from "@/lib/booking/pricing/sizeBrackets";
import type { DeliveryTypeKey } from "@/lib/products/deliveryTypes";

// Website only: a size-priced product (Other furniture, "Andre møbler") is
// delivered as a small or a large item. Its volume and weight brackets
// (sizeBrackets.ts) carry a weight class — small LIGHT, large HEAVY — and the
// heavier pick decides: over 1.5 m³ OR over 50 kg is large. A small item is
// delivered at the product's own prices (the oven's); a large one at its own
// large-item prices, kept as options of this category (one per delivery type,
// edited in Edit prices, seeded from the side-by-side fridge's). The extra-item
// rate stays the product's either way. The HEAVY class also prices its return
// and floor surcharge (websiteWeightClass.ts).
//
// Applied to the catalog before pricing (withWebsiteSizeTiers), not to the
// priced lines, so choosing which item keeps the full delivery price sees the
// large price too. A size-priced product has one card per order (its size is
// the item's own), so swapping the product's prices is per item.

export const SIZE_LARGE_DELIVERY_CATEGORY = "size_large_delivery";

export const LARGE_DELIVERY_OPTION_CODES: Partial<Record<DeliveryTypeKey, string>> = {
  [DELIVERY_TYPES.FIRST_STEP]: "OF_LG_FIRST_STEP",
  [DELIVERY_TYPES.INDOOR]: "OF_LG_INDOOR",
};

export function isLargeSizeCard(card: SavedProductCard, product: CatalogProduct): boolean {
  return card.selectedExtraOptionIds.some((id) => {
    const option = product.options.find((o) => o.id === id);
    return !!option && isSizeBracketCategory(option.category) && option.weightClass === "HEAVY";
  });
}

function withLargeDeliveryPrices(product: CatalogProduct): CatalogProduct {
  return {
    ...product,
    deliveryTypes: product.deliveryTypes.map((deliveryType) => {
      const code = LARGE_DELIVERY_OPTION_CODES[deliveryType.key];
      const large = product.options.find(
        (o) => o.active && o.category === SIZE_LARGE_DELIVERY_CATEGORY && o.code === code,
      );
      if (!large) return deliveryType;
      return { ...deliveryType, price: large.effectiveCustomerPrice, subcontractorPrice: large.subcontractorPrice };
    }),
  };
}

// The catalog with each large size-priced item's delivery at its large-item
// prices; everything else (and a small item) is returned as is.
export function withWebsiteSizeTiers(cards: SavedProductCard[], catalogProducts: CatalogProduct[]): CatalogProduct[] {
  return catalogProducts.map((product) =>
    cards.some((card) => card.productId === product.id && isLargeSizeCard(card, product))
      ? withLargeDeliveryPrices(product)
      : product,
  );
}
