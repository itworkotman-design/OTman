import type { CatalogProduct, CatalogSpecialOption, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
import { getProductDeliveryTypeCode, getProductDeliveryTypeLabel, getProductDeliveryTypePrice } from "@/lib/products/deliveryTypes";
import type { ProductBreakdown, ProductCardLineItem } from "@/lib/booking/pricing/types";
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
} from "@/lib/booking/pricing/rules";

const PALLET_EXTRA_CODE = "PALLXTRAS1";
const PALLET_EXTRA_LABEL = "Ekstra pall";
const RETURN_IN_CODE = "RETURNIN";

type BuildProductBreakdownsOptions = {
  zeroBaseDeliveryPricesOver100Km?: boolean;
  forcedXtraDeliveryCardIds?: Set<number>;
  xtraPalletPrice?: number;
  xtraPalletSubcontractorPrice?: number;
};

type ReturnPricingState = {
  hasTransportCovered: boolean;
  hasReturnInApplied: boolean;
  returnInCardId: number | null;
};

function normalizeAutomaticXtraText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isFirstStepAutomaticXtra(option: CatalogSpecialOption) {
  const signal = [normalizeAutomaticXtraText(option.code), normalizeAutomaticXtraText(option.label), normalizeAutomaticXtraText(option.description)].join(" ");

  return signal.includes("first_step") || signal.includes("first step") || signal.includes("levering") || signal.includes("delivery");
}

function findAutomaticXtraSpecialOption(params: { catalogSpecialOptions: CatalogSpecialOption[]; deliveryType: SavedProductCard["deliveryType"] }) {
  const { catalogSpecialOptions, deliveryType } = params;
  const activeXtraOptions = catalogSpecialOptions.filter((option) => option.active && option.type === "xtra");

  if (activeXtraOptions.length === 0) {
    return null;
  }

  if (deliveryType === DELIVERY_TYPES.FIRST_STEP) {
    return activeXtraOptions.find((option) => isFirstStepAutomaticXtra(option)) ?? activeXtraOptions[0];
  }

  return activeXtraOptions.find((option) => !isFirstStepAutomaticXtra(option)) ?? activeXtraOptions[0];
}

function shouldUseXtraDeliveryPricing(xtraDeliveryCardIds: Set<number>, currentCardId: number) {
  return xtraDeliveryCardIds.has(currentCardId);
}

function parsePrice(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTransportDeliveryType(deliveryType: SavedProductCard["deliveryType"]) {
  return (
    deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    deliveryType === DELIVERY_TYPES.INDOOR
  );
}

function isReturnOnlyDeliveryType(deliveryType: SavedProductCard["deliveryType"]) {
  return deliveryType === DELIVERY_TYPES.RETURN_ONLY;
}

function usesSharedDeliveryPricing(card: SavedProductCard, product: CatalogProduct) {
  if (!product.allowDeliveryTypes) {
    return false;
  }

  return isTransportDeliveryType(card.deliveryType);
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

function getXtraDeliveryCardIds(cards: SavedProductCard[], catalogProducts: CatalogProduct[]) {
  const candidates = cards
    .map((card, index) => {
      if (!card.productId) {
        return null;
      }

      const product = catalogProducts.find((item) => item.id === card.productId && item.active) ?? null;

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
      (candidate.standardPrice === mainCandidate.standardPrice && candidate.index < mainCandidate.index)
    ) {
      mainCandidate = candidate;
    }
  }

  return new Set(candidates.filter((candidate) => candidate.cardId !== mainCandidate.cardId).map((candidate) => candidate.cardId));
}

function getOrderHasTransportCovered(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
) {
  return cards.some((card) => {
    if (!card.productId || !isTransportDeliveryType(card.deliveryType)) {
      return false;
    }

    const product =
      catalogProducts.find((item) => item.id === card.productId && item.active) ??
      null;

    return !!product?.allowDeliveryTypes;
  });
}

function getReturnInCardId(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
) {
  const candidates = cards
    .map((card) => {
      if (!card.productId || !isReturnOnlyDeliveryType(card.deliveryType)) {
        return null;
      }

      const product =
        catalogProducts.find((item) => item.id === card.productId && item.active) ??
        null;

      if (!product?.allowDeliveryTypes) {
        return null;
      }

      return {
        cardId: card.cardId,
        productLabel: product.label.trim().toLowerCase(),
        productCode: product.code.trim().toLowerCase(),
        productId: product.id.trim().toLowerCase(),
      };
    })
    .filter((item) => item !== null);

  if (candidates.length === 0) {
    return null;
  }

  const [primary] = [...candidates].sort((a, b) => {
    const labelCompare = a.productLabel.localeCompare(b.productLabel);
    if (labelCompare !== 0) return labelCompare;

    const codeCompare = a.productCode.localeCompare(b.productCode);
    if (codeCompare !== 0) return codeCompare;

    const idCompare = a.productId.localeCompare(b.productId);
    if (idCompare !== 0) return idCompare;

    return a.cardId - b.cardId;
  });

  return primary.cardId;
}

function findSelectedReturnSpecialOption(catalogSpecialOptions: CatalogSpecialOption[], selectedReturnOptionId: string | null) {
  if (!selectedReturnOptionId) return null;

  return catalogSpecialOptions.find((o) => o.active && o.type === "return" && o.id === selectedReturnOptionId) ?? null;
}

function appendSelectedReturnOption(
  items: ProductCardLineItem[],
  selectedReturn: CatalogSpecialOption,
  amount: number,
  priceOverride?: number,
) {
  items.push({
    kind: "productOption",
    productOptionId: selectedReturn.id,
    qty: amount,
    ...(priceOverride === undefined ? {} : { priceOverride }),
  });
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
  return product.options.find((option) => normalizedUpper(option.code) === OPTION_CODES.DEMONT) ?? null;
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

function appendCustomSectionItems(items: ProductCardLineItem[], card: SavedProductCard, product: CatalogProduct, qty: number) {
  for (const selection of card.customSectionSelections) {
    const section = product.customSections.find((item) => item.id === selection.sectionId);
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
        subcontractorUnitPrice: Number(option.subcontractorPrice) || 0,
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
  xtraPalletPrice: number,
  xtraPalletSubcontractorPrice: number,
  returnPricingState: ReturnPricingState,
): ProductCardLineItem[] {
  const items: ProductCardLineItem[] = [];
  const amount = getAmount(card, product);
  const hoursInput = getHoursInput(card, product);
  const showInstallOptions =
    product.allowInstallOptions && (!product.allowDeliveryTypes || showsInstallOptions(card.deliveryType) || card.selectedInstallOptionIds.length > 0);
  const showReturnOptions =
    product.allowReturnOptions && (!product.allowDeliveryTypes || showsReturnOptions(card.deliveryType) || !!card.selectedReturnOptionId);
  const installSelected = card.selectedInstallOptionIds.length > 0;
  const showExtras = product.allowExtraServices && (!product.allowDeliveryTypes || showsExtraCheckboxes(card.deliveryType)) && !installSelected;
  const showDemont = product.allowDemont && (!product.allowDeliveryTypes || showsExtraCheckboxes(card.deliveryType));
  const demontOption = findDemontOption(product);
  const baseProductOption = findBaseProductOption(product);
  let returnOnlySelectedReturnPriceOverride: number | undefined;

  if (product.allowDeliveryTypes && isTransportDeliveryType(card.deliveryType)) {
    const xtraOption = useXtraDeliveryPricing
      ? findAutomaticXtraSpecialOption({
          catalogSpecialOptions,
          deliveryType: card.deliveryType,
        })
      : null;
    const xtraDeliveryPrice = useXtraDeliveryPricing
      ? xtraOption
        ? parsePrice(xtraOption.effectiveCustomerPrice)
        : getProductDeliveryTypePrice({
            deliveryTypes: product.deliveryTypes,
            key: card.deliveryType,
            useXtraPrice: true,
          })
      : undefined;
    const xtraDeliverySubcontractorPrice = useXtraDeliveryPricing
      ? xtraOption
        ? parsePrice(xtraOption.subcontractorPrice)
        : getProductDeliveryTypePrice({
            deliveryTypes: product.deliveryTypes,
            key: card.deliveryType,
            useXtraPrice: true,
            subcontractor: true,
          })
      : undefined;
    const standardDeliveryPrice = getProductDeliveryTypePrice({
      deliveryTypes: product.deliveryTypes,
      key: card.deliveryType,
    });
    const standardDeliverySubcontractorPrice = getProductDeliveryTypePrice({
      deliveryTypes: product.deliveryTypes,
      key: card.deliveryType,
      subcontractor: true,
    });
    const deliveryTypeCode = getProductDeliveryTypeCode(product.deliveryTypes, card.deliveryType);
    const deliveryTypeLabel = getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType);

    items.push({
      kind: "deliveryType",
      code: xtraDeliveryPrice !== undefined ? OPTION_CODES.XTRA : deliveryTypeCode,
      label: deliveryTypeLabel,
      qty: 1,
      unitPrice: shouldZeroBaseDeliveryPrice(card.deliveryType, useXtraDeliveryPricing, zeroBaseDeliveryPricesOver100Km)
        ? 0
        : (xtraDeliveryPrice ?? standardDeliveryPrice),
      subcontractorUnitPrice: shouldZeroBaseDeliveryPrice(card.deliveryType, useXtraDeliveryPricing, zeroBaseDeliveryPricesOver100Km)
        ? 0
        : (xtraDeliverySubcontractorPrice ?? standardDeliverySubcontractorPrice),
    });

    returnPricingState.hasTransportCovered = true;

    if (isDeliveryTypeWithExtraAmount(card.deliveryType) && amount > 1) {
      const extraAmountXtraOption = findAutomaticXtraSpecialOption({
        catalogSpecialOptions,
        deliveryType: card.deliveryType,
      });

      if (extraAmountXtraOption) {
        items.push({
          kind: "productOption",
          productOptionId: extraAmountXtraOption.id,
          qty: amount - 1,
        });
      }
    }
  }

  if (product.allowDeliveryTypes && isReturnOnlyDeliveryType(card.deliveryType)) {
    const shouldApplyReturnIn =
      !returnPricingState.hasTransportCovered &&
      !returnPricingState.hasReturnInApplied &&
      returnPricingState.returnInCardId === card.cardId;

    if (shouldApplyReturnIn) {
      const returnInPrice = getProductDeliveryTypePrice({
        deliveryTypes: product.deliveryTypes,
        key: card.deliveryType,
      });
      const returnInSubcontractorPrice = getProductDeliveryTypePrice({
        deliveryTypes: product.deliveryTypes,
        key: card.deliveryType,
        subcontractor: true,
      });
      const returnInLabel = getProductDeliveryTypeLabel(
        product.deliveryTypes,
        card.deliveryType,
      );

      items.push({
        kind: "deliveryType",
        code: RETURN_IN_CODE,
        label: returnInLabel,
        qty: 1,
        unitPrice: shouldZeroBaseDeliveryPrice(
          card.deliveryType,
          false,
          zeroBaseDeliveryPricesOver100Km,
        )
          ? 0
          : returnInPrice,
        subcontractorUnitPrice: shouldZeroBaseDeliveryPrice(
          card.deliveryType,
          false,
          zeroBaseDeliveryPricesOver100Km,
        )
          ? 0
          : returnInSubcontractorPrice,
      });

      returnPricingState.hasReturnInApplied = true;
      returnOnlySelectedReturnPriceOverride = 0;
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

    if (
      card.deliveryType !== DELIVERY_TYPES.INSTALL_ONLY &&
      showReturnOptions &&
      card.selectedReturnOptionId
    ) {
      const selectedReturn = findSelectedReturnSpecialOption(catalogSpecialOptions, card.selectedReturnOptionId);

      if (!selectedReturn) {
        return items;
      }

      if (isReturnOnlyDeliveryType(card.deliveryType)) {
        appendSelectedReturnOption(
          items,
          selectedReturn,
          amount,
          returnOnlySelectedReturnPriceOverride,
        );
      } else if (isTransportDeliveryType(card.deliveryType)) {
        appendSelectedReturnOption(items, selectedReturn, amount);
      } else {
        items.push({
          kind: "info",
          label: selectedReturn.description || selectedReturn.label || selectedReturn.code || "Return",
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

    if (amount > 1 && ((showInstallOptions && card.selectedInstallOptionIds.length > 0) || (!product.allowInstallOptions && !!baseProductOption))) {
      items.push({
        kind: "customPrice",
        code: PALLET_EXTRA_CODE,
        label: PALLET_EXTRA_LABEL,
        qty: amount - 1,
        unitPrice: xtraPalletPrice,
        subcontractorUnitPrice: xtraPalletSubcontractorPrice,
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

  if (
    card.deliveryType !== DELIVERY_TYPES.INSTALL_ONLY &&
    showReturnOptions &&
    card.selectedReturnOptionId
  ) {
    const selectedReturn = findSelectedReturnSpecialOption(catalogSpecialOptions, card.selectedReturnOptionId);

    if (!selectedReturn) {
      return items;
    }

    if (isReturnOnlyDeliveryType(card.deliveryType)) {
      appendSelectedReturnOption(
        items,
        selectedReturn,
        amount,
        returnOnlySelectedReturnPriceOverride,
      );
    } else if (isTransportDeliveryType(card.deliveryType)) {
      appendSelectedReturnOption(items, selectedReturn, amount);
    } else {
      items.push({
        kind: "info",
        label: selectedReturn.description || selectedReturn.label || selectedReturn.code || "Return",
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
  const automaticXtraDeliveryCardIds = getXtraDeliveryCardIds(cards, catalogProducts);
  const forcedXtraDeliveryCardIds = options?.forcedXtraDeliveryCardIds ?? new Set<number>();

  const xtraDeliveryCardIds = new Set([...automaticXtraDeliveryCardIds, ...forcedXtraDeliveryCardIds]);
  const zeroBaseDeliveryPricesOver100Km = options?.zeroBaseDeliveryPricesOver100Km ?? false;
  const xtraPalletPrice = options?.xtraPalletPrice ?? 250;
  const xtraPalletSubcontractorPrice =
    options?.xtraPalletSubcontractorPrice ?? 0;
  const returnPricingState: ReturnPricingState = {
    hasTransportCovered: getOrderHasTransportCovered(cards, catalogProducts),
    hasReturnInApplied: false,
    returnInCardId: getReturnInCardId(cards, catalogProducts),
  };

  return cards.flatMap<ProductBreakdown>((card) => {
    if (card.wordpressImportReadOnly) {
      return [
        {
          productName: card.wordpressImportReadOnly.productName,
          readOnly: true,
          comment: card.wordpressImportReadOnly.comment,
          items: card.wordpressImportReadOnly.rows.map((row) => ({
            kind: "customPrice" as const,
            code: row.code ?? "WP_PRICE",
            label: row.label,
            qty: row.quantity,
            unitPrice: row.priceCents / 100,
            subcontractorUnitPrice: 0,
          })),
        },
      ];
    }

    if (!card.productId) return [];

    const product = catalogProducts.find((p) => p.id === card.productId && p.active) ?? null;

    if (!product) return [];

    return [
      {
        productName: product.productType === "LABOR" ? `${product.label} (${getHoursInput(card, product)} h)` : product.label,
        productModelNumber: product.allowModelNumber && card.modelNumber.trim() ? card.modelNumber.trim() : null,
        items: buildItemsForCard(
          card,
          product,
          catalogSpecialOptions,
          shouldUseXtraDeliveryPricing(xtraDeliveryCardIds, card.cardId),
          zeroBaseDeliveryPricesOver100Km,
          xtraPalletPrice,
          xtraPalletSubcontractorPrice,
          returnPricingState,
        ),
      },
    ];
  });
}
