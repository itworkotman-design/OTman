import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPE_PRICES } from "@/lib/booking/deliveryTypes";
import type {
  ProductBreakdown,
  ProductCardLineItem,
} from "@/lib/booking/pricing/types";
import { findXtraOptionId } from "./priceLookup";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";

function isDeliveryTypeWithExtraAmount(deliveryType: string) {
  return (
    deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    deliveryType === DELIVERY_TYPES.INDOOR ||
    deliveryType === DELIVERY_TYPES.INSTALL_ONLY
  );
}

function buildItemsForCard(
  card: SavedProductCard,
  catalogProducts: CatalogProduct[],
): ProductCardLineItem[] {
  const items: ProductCardLineItem[] = [];
  const amount = Math.max(1, card.amount);
  const xtraOptionId = findXtraOptionId(catalogProducts);

  const showInstallOptions =
    card.deliveryType === "Innbæring" ||
    card.deliveryType === "Kun Installasjon/Montering";

  const showReturnOptions =
    card.deliveryType === "Innbæring" ||
    card.deliveryType === "Kun Installasjon/Montering" ||
    card.deliveryType === "Kun retur";

  const showExtras = card.deliveryType === "Innbæring";

  if (card.deliveryType) {
    items.push({
      kind: "deliveryType",
      code: card.deliveryType,
      qty: 1,
      unitPrice: DELIVERY_TYPE_PRICES[card.deliveryType] ?? 0,
    });

    if (
      isDeliveryTypeWithExtraAmount(card.deliveryType) &&
      amount > 1 &&
      xtraOptionId
    ) {
      items.push({
        kind: "productOption",
        productOptionId: xtraOptionId,
        qty: amount - 1,
      });
    }
  }

  if (showInstallOptions) {
    for (const id of card.selectedInstallOptionIds) {
      items.push({
        kind: "productOption",
        productOptionId: id,
        qty: amount,
      });
    }
  }

  if (showExtras) {
    for (const id of card.selectedExtraOptionIds) {
      items.push({
        kind: "productOption",
        productOptionId: id,
        qty: amount,
      });
    }
  }

  if (showReturnOptions && card.selectedReturnOptionId) {
    items.push({
      kind: "productOption",
      productOptionId: card.selectedReturnOptionId,
      qty: amount,
    });
  }

  return items;
}

export function buildProductBreakdowns(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): ProductBreakdown[] {
  return cards.flatMap((card) => {
    if (!card.productId) return [];

    const product =
      catalogProducts.find((p) => p.id === card.productId && p.active) ?? null;

    if (!product) return [];

    return [
      {
        productName: product.label,
        items: buildItemsForCard(card, catalogProducts),
      },
    ];
  });
}
