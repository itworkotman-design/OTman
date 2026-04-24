import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
import {
  getProductDeliveryTypeCode,
  getProductDeliveryTypeLabel,
  getProductDeliveryTypePrice,
} from "@/lib/products/deliveryTypes";
import type {
  ProductBreakdown,
  ProductCardLineItem,
} from "@/lib/booking/pricing/types";
import {
  isInstallOption,
  isReturnOption,
  isXtraOption,
  isExtraCheckboxOption,
  normalizedUpper,
  isDeliveryTypeWithExtraAmount,
  showsInstallOptions,
  showsReturnOptions,
  showsExtraCheckboxes,
  shouldPriceReturnOption,
} from "@/lib/booking/pricing/rules";

const PALLET_EXTRA_CODE = "PALLXTRAS1";
const PALLET_EXTRA_LABEL = "Ekstra pall";
const PALLET_EXTRA_UNIT_PRICE = 250;

type BuildProductBreakdownsOptions = {
  zeroBaseDeliveryPricesOver100Km?: boolean;
};

function findXtraSpecialOption(catalogSpecialOptions: CatalogSpecialOption[]) {
  return (
    catalogSpecialOptions.find((o) => o.active && o.type === "xtra") ?? null
  );
}

function shouldUseXtraDeliveryPricing(
  xtraDeliveryCardIds: Set<number>,
  currentCardId: number,
) {
  return xtraDeliveryCardIds.has(currentCardId);
}

function usesSharedDeliveryPricing(
  card: SavedProductCard,
  product: CatalogProduct,
) {
  if (!product.allowDeliveryTypes) {
    return false;
  }

  return (
    card.deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    card.deliveryType === DELIVERY_TYPES.INDOOR ||
    card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY ||
    card.deliveryType === DELIVERY_TYPES.RETURN_ONLY
  );
}

function shouldZeroBaseDeliveryPrice(
  deliveryType: SavedProductCard["deliveryType"],
  useXtraDeliveryPricing: boolean,
  zeroBaseDeliveryPricesOver100Km: boolean,
) {
  if (!zeroBaseDeliveryPricesOver100Km || useXtraDeliveryPricing) {
    return false;
  }

  return (
    deliveryType === DELIVERY_TYPES.INDOOR ||
    deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    deliveryType === DELIVERY_TYPES.INSTALL_ONLY ||
    deliveryType === DELIVERY_TYPES.RETURN_ONLY
  );
}

function getXtraDeliveryCardIds(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
) {
  const candidates = cards
    .map((card, index) => {
      if (!card.productId) {
        return null;
      }

      const product =
        catalogProducts.find(
          (item) => item.id === card.productId && item.active,
        ) ?? null;

      if (!product || !usesSharedDeliveryPricing(card, product)) {
        return null;
      }

      return {
        cardId: card.cardId,
        index,
        standardPrice: getProductDeliveryTypePrice({
          deliveryTypes: product.deliveryTypes,
          key: card.deliveryType,
        }),
      };
    })
    .filter((item) => item !== null);

  if (candidates.length <= 1) {
    return new Set<number>();
  }

  let mainCandidate = candidates[0];

  for (const candidate of candidates.slice(1)) {
    if (
      candidate.standardPrice > mainCandidate.standardPrice ||
      (candidate.standardPrice === mainCandidate.standardPrice &&
        candidate.index < mainCandidate.index)
    ) {
      mainCandidate = candidate;
    }
  }

  return new Set(
    candidates
      .filter((candidate) => candidate.cardId !== mainCandidate.cardId)
      .map((candidate) => candidate.cardId),
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

function findBaseProductOption(product: CatalogProduct) {
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

function findDemontOption(product: CatalogProduct) {
  return (
    product.options.find(
      (option) => normalizedUpper(option.code) === OPTION_CODES.DEMONT,
    ) ?? null
  );
}

function getAmount(card: SavedProductCard, product: CatalogProduct) {
  if (!product.allowQuantity && product.productType !== "PALLET") {
    return 1;
  }

  return Math.max(1, card.amount || 1);
}

function getHoursInput(card: SavedProductCard, product: CatalogProduct) {
  if (!product.allowHoursInput) return 1;
  return Math.max(0.5, card.hoursInput || 1);
}

function appendCustomSectionItems(
  items: ProductCardLineItem[],
  card: SavedProductCard,
  product: CatalogProduct,
  qty: number,
) {
  for (const selection of card.customSectionSelections) {
    const section = product.customSections.find(
      (item) => item.id === selection.sectionId,
    );
    if (!section) continue;

    for (const optionId of selection.optionIds) {
      const option = section.options.find((item) => item.id === optionId);
      if (!option) continue;

      if (!section.usePrices) {
        continue;
      }

      items.push({
        kind: "customPrice",
        code: option.code || section.title,
        label: option.label,
        qty,
        unitPrice: Number(option.price) || 0,
      });
    }
  }
}

function buildItemsForCard(
  card: SavedProductCard,
  product: CatalogProduct,
  catalogSpecialOptions: CatalogSpecialOption[],
  useXtraDeliveryPricing: boolean,
  zeroBaseDeliveryPricesOver100Km: boolean,
): ProductCardLineItem[] {
  const items: ProductCardLineItem[] = [];
  const amount = getAmount(card, product);
  const hoursInput = getHoursInput(card, product);
  const showInstallOptions =
    product.allowInstallOptions &&
    (!product.allowDeliveryTypes ||
      showsInstallOptions(card.deliveryType) ||
      card.selectedInstallOptionIds.length > 0);
  const showReturnOptions =
    product.allowReturnOptions &&
    (!product.allowDeliveryTypes ||
      showsReturnOptions(card.deliveryType) ||
      !!card.selectedReturnOptionId);
  const installSelected = card.selectedInstallOptionIds.length > 0;
  const showExtras =
    product.allowExtraServices &&
    (!product.allowDeliveryTypes || showsExtraCheckboxes(card.deliveryType)) &&
    !installSelected;
  const showDemont =
    product.allowDemont &&
    (!product.allowDeliveryTypes || showsExtraCheckboxes(card.deliveryType));
  const demontOption = findDemontOption(product);
  const baseProductOption = findBaseProductOption(product);

  if (product.allowDeliveryTypes && card.deliveryType) {
    const xtraDeliveryPrice = useXtraDeliveryPricing
      ? getProductDeliveryTypePrice({
          deliveryTypes: product.deliveryTypes,
          key: card.deliveryType,
          useXtraPrice: true,
        })
      : undefined;
    const standardDeliveryPrice = getProductDeliveryTypePrice({
      deliveryTypes: product.deliveryTypes,
      key: card.deliveryType,
    });
    const deliveryTypeCode = getProductDeliveryTypeCode(
      product.deliveryTypes,
      card.deliveryType,
    );
    const deliveryTypeLabel = getProductDeliveryTypeLabel(
      product.deliveryTypes,
      card.deliveryType,
    );

    items.push({
      kind: "deliveryType",
      code: deliveryTypeCode,
      label:
        xtraDeliveryPrice !== undefined
          ? `${deliveryTypeLabel} (${OPTION_CODES.XTRA})`
          : deliveryTypeLabel,
      qty: 1,
      unitPrice: shouldZeroBaseDeliveryPrice(
        card.deliveryType,
        useXtraDeliveryPricing,
        zeroBaseDeliveryPricesOver100Km,
      )
        ? 0
        : (xtraDeliveryPrice ?? standardDeliveryPrice),
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

  if (product.productType === "LABOR") {
    if (showInstallOptions && card.selectedInstallOptionIds.length > 0) {
      for (const id of card.selectedInstallOptionIds) {
        items.push({
          kind: "productOption",
          productOptionId: id,
          qty: hoursInput,
        });
      }
    } else if (!product.allowInstallOptions && baseProductOption) {
      items.push({
        kind: "productOption",
        productOptionId: baseProductOption.id,
        qty: hoursInput,
      });
    }

    if (showReturnOptions && card.selectedReturnOptionId) {
  const selectedReturn = findSelectedReturnSpecialOption(
    catalogSpecialOptions,
    card.selectedReturnOptionId,
  );

  if (!selectedReturn) {
    return items;
  }

  const forcePriceReturnOption =
    card.deliveryType === DELIVERY_TYPES.RETURN_ONLY && useXtraDeliveryPricing;

  if (shouldPriceReturnOption(card.deliveryType) || forcePriceReturnOption) {
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
    appendCustomSectionItems(items, card, product, 1);
    return items;
  }

  if (product.productType === "PALLET") {
    if (showInstallOptions && card.selectedInstallOptionIds.length > 0) {
      for (const id of card.selectedInstallOptionIds) {
        items.push({
          kind: "productOption",
          productOptionId: id,
          qty: 1,
        });
      }
    } else if (!product.allowInstallOptions && baseProductOption) {
      items.push({
        kind: "productOption",
        productOptionId: baseProductOption.id,
        qty: 1,
      });
    }

    if (
      amount > 1 &&
      ((showInstallOptions && card.selectedInstallOptionIds.length > 0) ||
        (!product.allowInstallOptions && !!baseProductOption))
    ) {
      items.push({
        kind: "customPrice",
        code: PALLET_EXTRA_CODE,
        label: PALLET_EXTRA_LABEL,
        qty: amount - 1,
        unitPrice: PALLET_EXTRA_UNIT_PRICE,
      });
    }

    appendCustomSectionItems(items, card, product, amount);
    return items;
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

  if (showDemont && !installSelected && card.demontEnabled && demontOption) {
    items.push({
      kind: "productOption",
      productOptionId: demontOption.id,
      qty: amount,
    });
  }

  if (showReturnOptions && card.selectedReturnOptionId) {
    const selectedReturn = findSelectedReturnSpecialOption(
      catalogSpecialOptions,
      card.selectedReturnOptionId,
    );

    if (!selectedReturn) {
      return items;
    }

    const forcePriceReturnOption =
      card.deliveryType === DELIVERY_TYPES.RETURN_ONLY &&
      useXtraDeliveryPricing;

    if (shouldPriceReturnOption(card.deliveryType) || forcePriceReturnOption) {
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

  appendCustomSectionItems(items, card, product, amount);

  return items;
}

export function buildProductBreakdowns(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
  options?: BuildProductBreakdownsOptions,
): ProductBreakdown[] {
  const xtraDeliveryCardIds = getXtraDeliveryCardIds(cards, catalogProducts);
  const zeroBaseDeliveryPricesOver100Km =
    options?.zeroBaseDeliveryPricesOver100Km ?? false;

  return cards.flatMap((card) => {
    if (!card.productId) return [];

    const product =
      catalogProducts.find((p) => p.id === card.productId && p.active) ?? null;

    if (!product) return [];

    return [
      {
        productName:
          product.productType === "LABOR"
            ? `${product.label} (${getHoursInput(card, product)} h)`
            : product.label,
        productModelNumber:
          product.allowModelNumber && card.modelNumber.trim()
            ? card.modelNumber.trim()
            : null,
        items: buildItemsForCard(
          card,
          product,
          catalogSpecialOptions,
          shouldUseXtraDeliveryPricing(xtraDeliveryCardIds, card.cardId),
          zeroBaseDeliveryPricesOver100Km,
        ),
      },
    ];
  });
}
