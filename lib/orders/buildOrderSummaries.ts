import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

type Result = {
  productsSummary: string;
  deliveryTypeSummary: string;
  servicesSummary: string;
};

function getCardCount(card: SavedProductCard) {
  const possibleCount =
    (card as { amount?: number }).amount ??
    (card as { quantity?: number }).quantity ??
    1;

  return Number.isFinite(possibleCount) && possibleCount > 0
    ? Math.floor(possibleCount)
    : 1;
}

function getOptionText(
  option:
    | {
        description?: string | null;
        label?: string | null;
        code?: string | null;
      }
    | null
    | undefined,
) {
  return (
    option?.description?.trim() ||
    option?.label?.trim() ||
    option?.code?.trim() ||
    null
  );
}

export function buildOrderSummaries(
  productCards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): Result {
  const productNames: string[] = [];
  const deliveryTypes: string[] = [];
  const services: string[] = [];

  for (const card of productCards) {
    const product = catalogProducts.find((p) => p.id === card.productId);
    const count = getCardCount(card);

    for (let i = 0; i < count; i += 1) {
      if (product?.label) {
        productNames.push(product.label);
      }

      if (card.deliveryType) {
        deliveryTypes.push(card.deliveryType);
      }
    }

    for (const optionId of card.selectedInstallOptionIds) {
      const option = product?.options.find((o) => o.id === optionId);
      const text = getOptionText(option);
      if (text) services.push(text);
    }

    for (const optionId of card.selectedExtraOptionIds) {
      const productOption = product?.options.find((o) => o.id === optionId);
      const specialOption = catalogSpecialOptions.find(
        (o) => o.id === optionId,
      );
      const text = getOptionText(productOption ?? specialOption);
      if (text) services.push(text);
    }

    if (card.selectedReturnOptionId) {
      const special = catalogSpecialOptions.find(
        (o) => o.id === card.selectedReturnOptionId,
      );
      const text = getOptionText(special);
      if (text) services.push(text);
    }
  }

  return {
    productsSummary: productNames.join(", "),
    deliveryTypeSummary: deliveryTypes.join(", "),
    servicesSummary: services.join(", "),
  };
}
