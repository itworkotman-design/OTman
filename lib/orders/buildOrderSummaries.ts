import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";
import { isCustomSectionVisibleForDeliveryType } from "@/lib/products/customSections";
import { isSizePricedProduct, splitSizeBracketOptionIds } from "@/lib/booking/pricing/sizeBrackets";
import { calculateVolumeM3, isCompleteDimensions } from "@/lib/booking/pricing/sizeDimensions";

type Result = {
  productsSummary: string;
  deliveryTypeSummary: string;
  servicesSummary: string;
};

function getCardCount(card: SavedProductCard, product?: CatalogProduct | null) {
  if (!product?.allowQuantity && product?.productType !== "PALLET") {
    return 1;
  }

  const possibleCount = card.amount ?? (card as { quantity?: number }).quantity ?? 1;

  return Number.isFinite(possibleCount) && possibleCount > 0
    ? Math.floor(possibleCount)
    : 1;
}

function incrementLabelCount(
  counts: Map<string, number>,
  label: string | null | undefined,
  amount = 1,
) {
  const trimmedLabel = label?.trim();
  if (!trimmedLabel) return;

  counts.set(trimmedLabel, (counts.get(trimmedLabel) ?? 0) + amount);
}

function formatCountSummary(counts: Map<string, number>) {
  return Array.from(counts.entries(), ([label, count]) =>
    count > 1 ? `${label} x${count}` : label,
  ).join(", ");
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
  const productNames = new Map<string, number>();
  const deliveryTypes = new Map<string, number>();
  const services: string[] = [];

  for (const card of productCards) {
    const product = catalogProducts.find((p) => p.id === card.productId);
    const count = getCardCount(card, product);

    // A size-priced catch-all product ("Other furniture") is named with what
    // the customer said it is, so the summary shows e.g. "Other furniture
    // (Grandfather clock)" — staff and drivers need to know what it is.
    const itemName =
      product && isSizePricedProduct(product) && typeof card.modelNumber === "string" ? card.modelNumber.trim() : "";
    incrementLabelCount(productNames, itemName ? `${product?.label} (${itemName})` : product?.label, count);

    if (product?.allowDeliveryTypes && card.deliveryType) {
      incrementLabelCount(
        deliveryTypes,
        getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType),
        count,
      );
    }

    if (product?.allowInstallOptions) {
      for (const optionId of card.selectedInstallOptionIds) {
        const option = product?.options.find((o) => o.id === optionId);
        const text = getOptionText(option);
        if (text) services.push(text);
      }
    }

    // Size brackets (volume / weight) are always listed — staff and drivers
    // need the real size and weight — independent of the extras gate.
    const { sizeIds, otherIds } = product
      ? splitSizeBracketOptionIds(product, card.selectedExtraOptionIds)
      : { sizeIds: [] as string[], otherIds: card.selectedExtraOptionIds };

    if (isCompleteDimensions(card.sizeDimensionsCm)) {
      const { widthCm, heightCm, lengthCm } = card.sizeDimensionsCm;
      const volume = Number(calculateVolumeM3(card.sizeDimensionsCm).toFixed(3));
      services.push(`${widthCm} × ${heightCm} × ${lengthCm} cm (${volume} m³)`);
    }

    for (const optionId of sizeIds) {
      const text = getOptionText(product?.options.find((o) => o.id === optionId));
      if (text) services.push(text);
    }

    if (product?.allowExtraServices && card.selectedInstallOptionIds.length === 0) {
      for (const optionId of otherIds) {
        const productOption = product?.options.find((o) => o.id === optionId);
        const specialOption = catalogSpecialOptions.find(
          (o) => o.id === optionId,
        );
        const text = getOptionText(productOption ?? specialOption);
        if (text) services.push(text);
      }
    }

    if (
      product?.allowDemont &&
      card.demontEnabled &&
      card.selectedInstallOptionIds.length === 0
    ) {
      const demontOption = product.options.find((option) =>
        option.code?.trim().toUpperCase() === "DEMONT",
      );
      const text = getOptionText(demontOption);
      if (text) services.push(text);
    }

    if (product?.allowReturnOptions && card.selectedReturnOptionId) {
      const special = catalogSpecialOptions.find(
        (o) => o.id === card.selectedReturnOptionId,
      );
      const text = getOptionText(special);
      if (text) services.push(text);
    }

    if (product) {
      for (const selection of card.customSectionSelections) {
        const section = product.customSections.find(
          (item) => item.id === selection.sectionId,
        );
        if (!section) continue;
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

          services.push(
            section.title ? `${section.title}: ${option.label}` : option.label,
          );
        }
      }
    }
  }

  return {
    productsSummary: formatCountSummary(productNames),
    deliveryTypeSummary: formatCountSummary(deliveryTypes),
    servicesSummary: services.join(", "),
  };
}
