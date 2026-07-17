import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
import { normalizeProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import {
  getProductDeliveryTypeCode,
  getProductDeliveryTypeLabel,
  getProductDeliveryTypePrice,
} from "@/lib/products/deliveryTypes";
import { isCustomSectionVisibleForDeliveryType } from "@/lib/products/customSections";
import {
  canApplyReturnOption,
  findAutomaticXtraSpecialOption,
  getAutomaticXtraDeliveryCardIds,
  isTransportDeliveryType,
} from "@/lib/booking/pricing/sharedDeliveryLogic";
import {
  isInstallOption,
  isReturnOption,
  isXtraOption,
  isExtraCheckboxOption,
  normalizedUpper,
} from "@/lib/booking/pricing/rules";
import { computeLineKey } from "@/lib/booking/pricing/lineKey";

const PALLET_EXTRA_CODE = "PALLXTRAS1";
const PALLET_EXTRA_LABEL = "Ekstra pall";
const PALLET_EXTRA_PRICE_CENTS = 25000;

export type BuiltOrderItem = {
  cardId: number;

  productId: string | null;
  productCode: string | null;
  productName: string | null;

  deliveryType: string | null;

  itemType:
    | "PRODUCT_CARD"
    | "BASE_OPTION"
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

const MAX_INT32 = 2_147_483_647;

function safeInt32Cents(value: number): number | null {
  return value > MAX_INT32 || value < -MAX_INT32 ? null : value;
}

function decimalStringToCents(value: string | null | undefined): number | null {
  const n = Number(value ?? "0");
  if (!Number.isFinite(n)) return 0;
  return safeInt32Cents(Math.round(n * 100));
}

function getEffectiveCustomerPrice(option: {
  customerPrice: string;
  effectiveCustomerPrice?: string;
}) {
  return option.effectiveCustomerPrice ?? option.customerPrice;
}

function getAmount(card: SavedProductCard, product: CatalogProduct | null) {
  if (!product) return Math.max(1, card.amount || 1);
  if (!product.allowQuantity && product.productType !== "PALLET") return 1;
  return Math.max(1, card.amount || 1);
}

function getPeopleCount(card: SavedProductCard, product: CatalogProduct | null) {
  if (!product?.allowPeopleCount) return 1;
  return Math.max(1, Math.floor(card.peopleCount || 1));
}

function getHoursInput(card: SavedProductCard, product: CatalogProduct | null) {
  if (!product?.allowHoursInput) return 1;
  return Math.max(0.5, card.hoursInput || 1);
}

function findBaseProductOption(product: CatalogProduct | null) {
  if (!product) return null;

  return (
    product.options.find(
      (option) =>
        option.active &&
        !isInstallOption(option.category, option.code) &&
        !isReturnOption(option.category, option.code) &&
        !isXtraOption(option.category, option.code) &&
        !isExtraCheckboxOption(option.code),
    ) ??
    product.options.find((option) => option.active) ??
    null
  );
}

function findDemontOption(product: CatalogProduct | null) {
  if (!product) return null;

  return (
    product.options.find(
      (option) => normalizedUpper(option.code) === OPTION_CODES.DEMONT,
    ) ?? null
  );
}

function findXtraSpecialOption(
  catalogSpecialOptions: CatalogSpecialOption[],
) {
  return catalogSpecialOptions.find((option) => option.active && option.type === "xtra") ?? null;
}

function findMatchingWordpressSubcontractorRow(
  customerRow: NonNullable<SavedProductCard["wordpressImportReadOnly"]>["rows"][number],
  subcontractorRows: NonNullable<
    NonNullable<SavedProductCard["wordpressImportReadOnly"]>["subcontractorRows"]
  >,
  usedIndexes: Set<number>,
) {
  const normalizedCode = (customerRow.code ?? "").trim().toUpperCase();
  const normalizedLabel = customerRow.label.trim().toUpperCase();

  const exactIndex = subcontractorRows.findIndex((row, index) => {
    if (usedIndexes.has(index)) {
      return false;
    }

    return (
      (row.code ?? "").trim().toUpperCase() === normalizedCode &&
      row.label.trim().toUpperCase() === normalizedLabel &&
      row.quantity === customerRow.quantity
    );
  });

  if (exactIndex >= 0) {
    usedIndexes.add(exactIndex);
    return subcontractorRows[exactIndex];
  }

  const fallbackIndex = subcontractorRows.findIndex((_, index) => !usedIndexes.has(index));
  if (fallbackIndex >= 0) {
    usedIndexes.add(fallbackIndex);
    return subcontractorRows[fallbackIndex];
  }

  return undefined;
}

export function buildOrderItemsFromCards(
  productCards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): BuiltOrderItem[] {
  const items: BuiltOrderItem[] = [];
  const automaticXtraDeliveryCardIds = getAutomaticXtraDeliveryCardIds(
    productCards,
    catalogProducts,
  );

  for (const card of productCards) {
    if (card.wordpressImportReadOnly) {
      const subcontractorRows = card.wordpressImportReadOnly.subcontractorRows ?? [];
      const usedSubcontractorIndexes = new Set<number>();

      items.push({
        cardId: card.cardId,
        productId: null,
        productCode: null,
        productName: card.wordpressImportReadOnly.productName,
        deliveryType: null,
        itemType: "PRODUCT_CARD",
        optionId: null,
        optionCode: null,
        optionLabel: null,
        quantity: 1,
        customerPriceCents: null,
        subcontractorPriceCents: null,
        rawData: {
          source: "wordpress_sync",
          readOnly: true,
          comment: card.wordpressImportReadOnly.comment,
        },
      });

      for (const row of card.wordpressImportReadOnly.rows) {
        const subcontractorRow = findMatchingWordpressSubcontractorRow(
          row,
          subcontractorRows,
          usedSubcontractorIndexes,
        );

        items.push({
          cardId: card.cardId,
          productId: null,
          productCode: null,
          productName: card.wordpressImportReadOnly.productName,
          deliveryType: null,
          itemType: "EXTRA_OPTION",
          optionId: null,
          optionCode: row.code ?? null,
          optionLabel: row.label,
          quantity: row.quantity,
          customerPriceCents: row.priceCents,
          subcontractorPriceCents: subcontractorRow?.priceCents ?? null,
          rawData: {
            source: "wordpress_sync",
            readOnly: true,
            label: row.label,
            code: row.code ?? null,
          },
        });
      }

      continue;
    }

    const product =
      catalogProducts.find((p) => p.id === card.productId) ?? null;
    const deliveryTypeLabel =
      product?.allowDeliveryTypes && card.deliveryType
        ? getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType)
        : null;
    const amount = getAmount(card, product);
    const peopleCount = getPeopleCount(card, product);
    const hoursInput = getHoursInput(card, product);
    const baseOption = findBaseProductOption(product);
    const demontOption = findDemontOption(product);
    const installSelected = card.selectedInstallOptionIds.length > 0;
    const showInstallOptions =
      !!product?.allowInstallOptions &&
      (!product.allowDeliveryTypes || !!card.deliveryType);

    const autoDeliveryPrice = normalizeProductAutoDeliveryPrice(
      product?.autoDeliveryPrice,
    );

    items.push({
      cardId: card.cardId,
      productId: card.productId ?? null,
      productCode: product?.code ?? null,
      productName: product?.label ?? null,
      deliveryType: deliveryTypeLabel,
      itemType: "PRODUCT_CARD",
      optionId: null,
      optionCode: null,
      optionLabel: null,
      quantity: amount,
      customerPriceCents: null,
      subcontractorPriceCents: null,
      rawData: card,
    });

    if (
      product &&
      product.productType === "PHYSICAL" &&
      product.allowDeliveryTypes &&
      card.deliveryType &&
      !autoDeliveryPrice.enabled &&
      (isTransportDeliveryType(card.deliveryType) ||
        card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY)
    ) {
      const useXtraDeliveryPricing = automaticXtraDeliveryCardIds.has(card.cardId);
      const xtraOption = useXtraDeliveryPricing
        ? findAutomaticXtraSpecialOption({
            catalogSpecialOptions,
            deliveryType: card.deliveryType,
          })
        : null;

      const customerPriceCents = useXtraDeliveryPricing
        ? xtraOption
          ? decimalStringToCents(xtraOption.effectiveCustomerPrice)
          : safeInt32Cents(Math.round(
              getProductDeliveryTypePrice({
                deliveryTypes: product.deliveryTypes,
                key: card.deliveryType,
                useXtraPrice: true,
              }) * 100,
            ))
        : safeInt32Cents(Math.round(
            getProductDeliveryTypePrice({
              deliveryTypes: product.deliveryTypes,
              key: card.deliveryType,
            }) * 100,
          ));

      const subcontractorPriceCents = useXtraDeliveryPricing
        ? xtraOption
          ? decimalStringToCents(xtraOption.subcontractorPrice)
          : safeInt32Cents(Math.round(
              getProductDeliveryTypePrice({
                deliveryTypes: product.deliveryTypes,
                key: card.deliveryType,
                useXtraPrice: true,
                subcontractor: true,
              }) * 100,
            ))
        : safeInt32Cents(Math.round(
            getProductDeliveryTypePrice({
              deliveryTypes: product.deliveryTypes,
              key: card.deliveryType,
              subcontractor: true,
            }) * 100,
          ));

      if (customerPriceCents !== null && customerPriceCents > 0) {
        const deliveryTypeCode = getProductDeliveryTypeCode(
          product.deliveryTypes,
          card.deliveryType,
        );

        items.push({
          cardId: card.cardId,
          productId: card.productId ?? null,
          productCode: product.code,
          productName: product.label,
          deliveryType: deliveryTypeLabel,
          itemType: "EXTRA_OPTION",
          optionId: xtraOption?.id ?? null,
          optionCode: xtraOption?.code ?? deliveryTypeCode,
          optionLabel: deliveryTypeLabel ?? "",
          quantity: 1,
          customerPriceCents,
          subcontractorPriceCents,
          rawData: { source: "delivery_type_price" },
        });
      }
    }

    if (product && autoDeliveryPrice.enabled) {
      const xtraOption =
        autoDeliveryPrice.includeInXtraLogic &&
        automaticXtraDeliveryCardIds.has(card.cardId)
          ? findAutomaticXtraSpecialOption({
              catalogSpecialOptions,
              deliveryType: card.deliveryType,
            })
          : null;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product.code,
        productName: product.label,
        deliveryType: deliveryTypeLabel,
        itemType: "EXTRA_OPTION",
        optionId: xtraOption?.id ?? null,
        optionCode: xtraOption?.code ?? autoDeliveryPrice.code,
        optionLabel: xtraOption?.label ?? autoDeliveryPrice.label,
        quantity: 1,
        customerPriceCents: decimalStringToCents(
          xtraOption?.effectiveCustomerPrice ?? autoDeliveryPrice.price,
        ),
        subcontractorPriceCents: decimalStringToCents(
          xtraOption?.subcontractorPrice ?? autoDeliveryPrice.subcontractorPrice,
        ),
        rawData: {
          code: xtraOption?.code ?? autoDeliveryPrice.code,
          label: xtraOption?.label ?? autoDeliveryPrice.label,
          source: xtraOption ? "auto_delivery_price_xtra" : "auto_delivery_price",
        },
      });
    }

    if (product?.productType === "LABOR") {
      if (showInstallOptions && card.selectedInstallOptionIds.length > 0) {
        for (const optionId of card.selectedInstallOptionIds) {
          const option = product?.options.find((o) => o.id === optionId) ?? null;

          items.push({
            cardId: card.cardId,
            productId: card.productId ?? null,
            productCode: product?.code ?? null,
            productName: product?.label ?? null,
            deliveryType: null,
            itemType: "INSTALL_OPTION",
            optionId,
            optionCode: option?.code ?? null,
            optionLabel: option?.label ?? null,
            quantity: hoursInput,
            customerPriceCents: option
              ? decimalStringToCents(getEffectiveCustomerPrice(option))
              : null,
            subcontractorPriceCents: option
              ? decimalStringToCents(option.subcontractorPrice)
              : null,
            rawData: {
              ...(option ?? {}),
              peopleCount,
              hoursInput,
            },
          });
        }
      } else if (!product.allowInstallOptions && baseOption) {
        items.push({
          cardId: card.cardId,
          productId: card.productId ?? null,
          productCode: product?.code ?? null,
          productName: product?.label ?? null,
          deliveryType: null,
          itemType: "BASE_OPTION",
          optionId: baseOption.id,
          optionCode: baseOption.code,
          optionLabel: baseOption.label ?? null,
          quantity: hoursInput,
          customerPriceCents: decimalStringToCents(
            getEffectiveCustomerPrice(baseOption),
          ),
          subcontractorPriceCents: decimalStringToCents(
            baseOption.subcontractorPrice,
          ),
          rawData: {
            ...baseOption,
            peopleCount,
            hoursInput,
          },
        });
      }
    } else if (product?.productType === "PALLET") {
      if (showInstallOptions && card.selectedInstallOptionIds.length > 0) {
        for (const optionId of card.selectedInstallOptionIds) {
          const option = product?.options.find((o) => o.id === optionId) ?? null;

          items.push({
            cardId: card.cardId,
            productId: card.productId ?? null,
            productCode: product?.code ?? null,
            productName: product?.label ?? null,
            deliveryType: deliveryTypeLabel,
            itemType: "INSTALL_OPTION",
            optionId,
            optionCode: option?.code ?? null,
            optionLabel: option?.label ?? null,
            quantity: 1,
            customerPriceCents: option
              ? decimalStringToCents(getEffectiveCustomerPrice(option))
              : null,
            subcontractorPriceCents: option
              ? decimalStringToCents(option.subcontractorPrice)
              : null,
            rawData: option ?? undefined,
          });
        }
      } else if (!product.allowInstallOptions && baseOption) {
        items.push({
          cardId: card.cardId,
          productId: card.productId ?? null,
          productCode: product?.code ?? null,
          productName: product?.label ?? null,
          deliveryType: deliveryTypeLabel,
          itemType: "BASE_OPTION",
          optionId: baseOption.id,
          optionCode: baseOption.code,
          optionLabel: baseOption.label ?? null,
          quantity: 1,
          customerPriceCents: decimalStringToCents(
            getEffectiveCustomerPrice(baseOption),
          ),
          subcontractorPriceCents: decimalStringToCents(
            baseOption.subcontractorPrice,
          ),
          rawData: {
            ...baseOption,
            peopleCount,
            hoursInput,
          },
        });
      }

      if (
        amount > 1 &&
        ((showInstallOptions && card.selectedInstallOptionIds.length > 0) ||
          (!product.allowInstallOptions && !!baseOption))
      ) {
        items.push({
          cardId: card.cardId,
          productId: card.productId ?? null,
          productCode: product?.code ?? null,
          productName: product?.label ?? null,
          deliveryType: deliveryTypeLabel,
          itemType: "EXTRA_OPTION",
          optionId: null,
          optionCode: PALLET_EXTRA_CODE,
          optionLabel: PALLET_EXTRA_LABEL,
          quantity: amount - 1,
          customerPriceCents: PALLET_EXTRA_PRICE_CENTS,
          subcontractorPriceCents: 0,
          rawData: {
            code: PALLET_EXTRA_CODE,
            label: PALLET_EXTRA_LABEL,
            description: PALLET_EXTRA_LABEL,
          },
        });
      }
    }

    for (const selection of card.customSectionSelections) {
      const section = product?.customSections.find(
        (item) => item.id === selection.sectionId,
      );
      if (!product || !section) continue;
      if (
        !isCustomSectionVisibleForDeliveryType({
          allowDeliveryTypes: product.allowDeliveryTypes,
          deliveryType: card.deliveryType,
          section,
        })
      ) {
        continue;
      }

      for (const optionId of selection.optionIds) {
        const option = section.options.find((item) => item.id === optionId);
        if (!option) continue;

        items.push({
          cardId: card.cardId,
          productId: card.productId ?? null,
          productCode: product?.code ?? null,
          productName: product?.label ?? null,
          deliveryType: deliveryTypeLabel,
          itemType: "EXTRA_OPTION",
          optionId: option.id,
          optionCode: option.code || section.title || null,
          optionLabel: option.label,
          quantity: section.usePrices ? amount : 1,
          customerPriceCents: section.usePrices
            ? decimalStringToCents(option.price)
            : null,
          subcontractorPriceCents: section.usePrices
            ? decimalStringToCents(option.subcontractorPrice)
            : null,
          rawData: {
            code: option.code || section.title || null,
            label: option.label,
            description: `${section.title}: ${option.label}`,
          },
        });
      }
    }

    if (product?.allowInstallOptions && product.productType === "PHYSICAL") {
      for (const optionId of card.selectedInstallOptionIds) {
      const option = product?.options.find((o) => o.id === optionId) ?? null;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: deliveryTypeLabel,
        itemType: "INSTALL_OPTION",
        optionId,
        optionCode: option?.code ?? null,
        optionLabel: option?.label ?? null,
        quantity: amount,
        customerPriceCents: option
          ? decimalStringToCents(getEffectiveCustomerPrice(option))
          : null,
        subcontractorPriceCents: option
          ? decimalStringToCents(option.subcontractorPrice)
          : null,
        rawData: option ?? undefined,
      });
    }
    }

    if (product?.allowExtraServices && !installSelected) {
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
          deliveryType: deliveryTypeLabel,
          itemType: "EXTRA_OPTION",
          optionId,
          optionCode: option?.code ?? null,
          optionLabel: option?.label ?? null,
          quantity: amount,
          customerPriceCents: option
            ? decimalStringToCents(getEffectiveCustomerPrice(option))
            : null,
          subcontractorPriceCents: option
            ? decimalStringToCents(option.subcontractorPrice)
            : null,
          rawData: option ?? undefined,
        });
      }
    }

    if (
      product?.allowDemont &&
      !installSelected &&
      card.demontEnabled &&
      demontOption
    ) {
      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: deliveryTypeLabel,
        itemType: "EXTRA_OPTION",
        optionId: demontOption.id,
        optionCode: demontOption.code,
        optionLabel: demontOption.label ?? null,
        quantity: amount,
        customerPriceCents: decimalStringToCents(
          getEffectiveCustomerPrice(demontOption),
        ),
        subcontractorPriceCents: decimalStringToCents(
          demontOption.subcontractorPrice,
        ),
        rawData: demontOption,
      });
    }

    const returnDeliveryTypeConfig = product?.allowDeliveryTypes
      ? (product.deliveryTypes.find((dt) => dt.key === card.deliveryType) ?? null)
      : null;
    const showReturnOptionForCard = returnDeliveryTypeConfig
      ? returnDeliveryTypeConfig.allowReturnOptions
      : canApplyReturnOption({
          allowReturnOptions: product?.allowReturnOptions ?? false,
          allowDeliveryTypes: product?.allowDeliveryTypes ?? false,
          deliveryType: card.deliveryType,
        });

    if (product && showReturnOptionForCard && card.selectedReturnOptionId) {
      const special =
        catalogSpecialOptions.find(
          (o) => o.id === card.selectedReturnOptionId,
        ) ?? null;

      items.push({
        cardId: card.cardId,
        productId: card.productId ?? null,
        productCode: product?.code ?? null,
        productName: product?.label ?? null,
        deliveryType: deliveryTypeLabel,
        itemType: "RETURN_OPTION",
        optionId: card.selectedReturnOptionId,
        optionCode: special?.code ?? null,
        optionLabel: special?.label ?? null,
        quantity: amount,
        customerPriceCents: special
          ? decimalStringToCents(getEffectiveCustomerPrice(special))
          : null,
        subcontractorPriceCents: special
          ? decimalStringToCents(special.subcontractorPrice)
          : null,
        rawData: special ?? undefined,
      });
    }

  }

  const nulledLineKeysByCardId = new Map(
    productCards
      .filter((card) => !card.wordpressImportReadOnly)
      .map((card) => [
        card.cardId,
        {
          customer: card.nulledLineKeysForCustomer ?? [],
          subcontractor: card.nulledLineKeysForSubcontractor ?? [],
        },
      ]),
  );

  return items.map((item) => {
    const nulledKeys = nulledLineKeysByCardId.get(item.cardId);
    if (!nulledKeys) return item;

    const lineKey = computeLineKey({
      optionId: item.optionId,
      code: item.optionCode,
    });
    if (lineKey === null) return item;

    const nulledForCustomer = nulledKeys.customer.includes(lineKey);
    const nulledForSubcontractor = nulledKeys.subcontractor.includes(lineKey);

    return {
      ...item,
      customerPriceCents:
        nulledForCustomer && typeof item.customerPriceCents === "number"
          ? 0
          : item.customerPriceCents,
      subcontractorPriceCents:
        nulledForSubcontractor &&
        typeof item.subcontractorPriceCents === "number"
          ? 0
          : item.subcontractorPriceCents,
    };
  });
}

export function hasDeliveryPriceLines(items: BuiltOrderItem[]): boolean {
  return items.some(
    (item) =>
      typeof item.rawData === "object" &&
      item.rawData !== null &&
      (item.rawData as Record<string, unknown>).source === "delivery_type_price",
  );
}
