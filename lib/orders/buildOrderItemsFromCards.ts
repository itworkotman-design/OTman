import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

export type BuiltOrderItem = {
  cardId: number;

  productId: string | null;
  productCode: string | null;
  productName: string | null;

  deliveryType: string | null;

  itemType:
    | "PRODUCT_CARD"
    | "INSTALL_OPTION"
    | "EXTRA_OPTION"
    | "RETURN_OPTION";

  optionId: string | null;
  optionCode: string | null;
  optionLabel: string | null;

  quantity: number;

  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;

  rawData?: unknown;
};

function decimalStringToCents(value: string | null | undefined) {
  const n = Number(value ?? "0");
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function buildOrderItemsFromCards(
  productCards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): BuiltOrderItem[] {
  const items: BuiltOrderItem[] = [];

  for (const card of productCards) {
    const product =
      catalogProducts.find((p) => p.id === card.productId) ?? null;

    items.push({
      cardId: card.cardId,
      productId: card.productId ?? null,
      productCode: product?.code ?? null,
      productName: product?.label ?? null,
      deliveryType: card.deliveryType || null,
      itemType: "PRODUCT_CARD",
      optionId: null,
      optionCode: null,
      optionLabel: null,
      quantity: card.amount || 1,
      customerPriceCents: null,
      subcontractorPriceCents: null,
      rawData: card,
    });

    for (const optionId of card.selectedInstallOptionIds) {
      const option = product?.options.find((o) => o.id === optionId) ?? null;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: card.deliveryType || null,
        itemType: "INSTALL_OPTION",
        optionId,
        optionCode: option?.code ?? null,
        optionLabel: option?.label ?? null,
        quantity: 1,
        customerPriceCents: option
          ? decimalStringToCents(option.customerPrice)
          : null,
        subcontractorPriceCents: option
          ? decimalStringToCents(option.subcontractorPrice)
          : null,
        rawData: option ?? undefined,
      });
    }

    for (const optionId of card.selectedExtraOptionIds) {
      const productOption =
        product?.options.find((o) => o.id === optionId) ?? null;
      const specialOption =
        catalogSpecialOptions.find((o) => o.id === optionId) ?? null;

      const option = productOption ?? specialOption;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: card.deliveryType || null,
        itemType: "EXTRA_OPTION",
        optionId,
        optionCode: option?.code ?? null,
        optionLabel: option?.label ?? null,
        quantity: 1,
        customerPriceCents: option
          ? decimalStringToCents(option.customerPrice)
          : null,
        subcontractorPriceCents: option
          ? decimalStringToCents(option.subcontractorPrice)
          : null,
        rawData: option ?? undefined,
      });
    }

    if (card.selectedReturnOptionId) {
      const special =
        catalogSpecialOptions.find(
          (o) => o.id === card.selectedReturnOptionId,
        ) ?? null;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: card.deliveryType || null,
        itemType: "RETURN_OPTION",
        optionId: card.selectedReturnOptionId,
        optionCode: special?.code ?? null,
        optionLabel: special?.label ?? null,
        quantity: 1,
        customerPriceCents: special
          ? decimalStringToCents(special.customerPrice)
          : null,
        subcontractorPriceCents: special
          ? decimalStringToCents(special.subcontractorPrice)
          : null,
        rawData: special ?? undefined,
      });
    }
  }

  return items;
}
