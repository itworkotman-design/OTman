import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPE_PRICES } from "@/lib/booking/deliveryTypes";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
import type {
  ProductBreakdown,
  ProductCardLineItem,
} from "@/lib/booking/pricing/types";
import {
  isDeliveryTypeWithExtraAmount,
  showsInstallOptions,
  showsReturnOptions,
  showsExtraCheckboxes,
  shouldPriceReturnOption,
} from "@/lib/booking/pricing/rules";

function findXtraSpecialOption(catalogSpecialOptions: CatalogSpecialOption[]) {
  return (
    catalogSpecialOptions.find((o) => o.active && o.type === "xtra") ?? null
  );
}

function findSelectedReturnSpecialOption(
  catalogSpecialOptions: CatalogSpecialOption[],
  selectedReturnOptionId: string | null,
) {
  if (!selectedReturnOptionId) return null;

  return (
    catalogSpecialOptions.find(
      (o) => o.active && o.type === "return" && o.id === selectedReturnOptionId,
    ) ?? null
  );
}

function buildItemsForCard(
  card: SavedProductCard,
  product: CatalogProduct,
  catalogSpecialOptions: CatalogSpecialOption[],
): ProductCardLineItem[] {
  const items: ProductCardLineItem[] = [];
  const amount = Math.max(1, card.amount);
  const showInstallOptions = showsInstallOptions(card.deliveryType);
  const showReturnOptions = showsReturnOptions(card.deliveryType);
  const showExtras = showsExtraCheckboxes(card.deliveryType);

  if (card.deliveryType) {
    items.push({
      kind: "deliveryType",
      code: card.deliveryType,
      qty: 1,
      unitPrice: DELIVERY_TYPE_PRICES[card.deliveryType] ?? 0,
    });

    if (isDeliveryTypeWithExtraAmount(card.deliveryType) && amount > 1) {
      const xtraOption = findXtraSpecialOption(catalogSpecialOptions);

      if (xtraOption) {
        items.push({
          kind: "productOption",
          productOptionId: xtraOption.id,
          qty: amount - 1,
        });
      }
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
    const selectedReturn = findSelectedReturnSpecialOption(
      catalogSpecialOptions,
      card.selectedReturnOptionId,
    );

    if (!selectedReturn) {
      return items;
    }

    if (shouldPriceReturnOption(card.deliveryType)) {
      items.push({
        kind: "productOption",
        productOptionId: selectedReturn.id,
        qty: amount,
      });
    } else {
      items.push({
        kind: "info",
        label:
          selectedReturn.description ||
          selectedReturn.label ||
          selectedReturn.code ||
          "Return",
        qty: amount,
      });
    }
  }

  return items;
}

export function buildProductBreakdowns(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): ProductBreakdown[] {
  return cards.flatMap((card) => {
    if (!card.productId) return [];

    const product =
      catalogProducts.find((p) => p.id === card.productId && p.active) ?? null;

    if (!product) return [];

    return [
      {
        productName: product.label,
        items: buildItemsForCard(card, product, catalogSpecialOptions),
      },
    ];
  });
}
