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

export function buildOrderSummaries(
  productCards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): Result {
  const productNames = productCards
    .map((card) => {
      const product = catalogProducts.find((p) => p.id === card.productId);
      return product?.label ?? null;
    })
    .filter((value): value is string => Boolean(value));

 const deliveryTypes = Array.from(
   new Set(
     productCards
       .map((card) => card.deliveryType)
       .filter((value): value is NonNullable<typeof value> => Boolean(value)),
   ),
 );

  const services: string[] = [];

  for (const card of productCards) {
    const product = catalogProducts.find((p) => p.id === card.productId);

    for (const optionId of card.selectedInstallOptionIds) {
      const option = product?.options.find((o) => o.id === optionId);
      if (option?.label) services.push(option.label);
    }

    for (const optionId of card.selectedExtraOptionIds) {
      const productOption = product?.options.find((o) => o.id === optionId);
      const specialOption = catalogSpecialOptions.find(
        (o) => o.id === optionId,
      );
      const option = productOption ?? specialOption;

      if (option?.label) services.push(option.label);
    }

    if (card.selectedReturnOptionId) {
      const special = catalogSpecialOptions.find(
        (o) => o.id === card.selectedReturnOptionId,
      );
      if (special?.label) services.push(special.label);
    }
  }

  return {
    productsSummary: Array.from(new Set(productNames)).join(", "),
    deliveryTypeSummary: deliveryTypes.join(", "),
    servicesSummary: Array.from(new Set(services)).join(", "),
  };
}
