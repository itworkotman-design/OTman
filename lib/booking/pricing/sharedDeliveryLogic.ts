import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { normalizeProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { getProductDeliveryTypePrice } from "@/lib/products/deliveryTypes";

function normalizeAutomaticXtraText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isFirstStepAutomaticXtra(option: CatalogSpecialOption) {
  const signal = [
    normalizeAutomaticXtraText(option.code),
    normalizeAutomaticXtraText(option.label),
    normalizeAutomaticXtraText(option.description),
  ].join(" ");

  return (
    signal.includes("first_step") ||
    signal.includes("first step") ||
    signal.includes("levering") ||
    signal.includes("delivery")
  );
}

export function findAutomaticXtraSpecialOption(params: {
  catalogSpecialOptions: CatalogSpecialOption[];
  deliveryType: SavedProductCard["deliveryType"];
}) {
  const { catalogSpecialOptions, deliveryType } = params;
  const activeXtraOptions = catalogSpecialOptions.filter(
    (option) => option.active && option.type === "xtra",
  );

  if (activeXtraOptions.length === 0) {
    return null;
  }

  if (deliveryType === DELIVERY_TYPES.FIRST_STEP) {
    return (
      activeXtraOptions.find((option) => isFirstStepAutomaticXtra(option)) ??
      activeXtraOptions[0]
    );
  }

  return (
    activeXtraOptions.find((option) => !isFirstStepAutomaticXtra(option)) ??
    activeXtraOptions[0]
  );
}

export function isTransportDeliveryType(
  deliveryType: SavedProductCard["deliveryType"],
) {
  return (
    deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    deliveryType === DELIVERY_TYPES.INDOOR
  );
}

export function isReturnOnlyDeliveryType(
  deliveryType: SavedProductCard["deliveryType"],
) {
  return deliveryType === DELIVERY_TYPES.RETURN_ONLY;
}

export function usesTransportDeliveryPricing(
  card: SavedProductCard,
  product: CatalogProduct,
) {
  if (!product.allowDeliveryTypes) {
    return false;
  }

  return isTransportDeliveryType(card.deliveryType);
}

export function supportsSharedAutoDeliveryPricing(product: CatalogProduct) {
  const autoDeliveryPrice = normalizeProductAutoDeliveryPrice(
    product.autoDeliveryPrice,
  );

  return autoDeliveryPrice.enabled && autoDeliveryPrice.includeInXtraLogic;
}

type SharedDeliveryCandidate = {
  cardId: number;
  index: number;
  standardPrice: number;
};

function getSharedDeliveryCandidate(
  card: SavedProductCard,
  product: CatalogProduct,
  index: number,
): SharedDeliveryCandidate | null {
  if (usesTransportDeliveryPricing(card, product)) {
    return {
      cardId: card.cardId,
      index,
      standardPrice: getProductDeliveryTypePrice({
        deliveryTypes: product.deliveryTypes,
        key: card.deliveryType,
      }),
    };
  }

  if (!supportsSharedAutoDeliveryPricing(product)) {
    return null;
  }

  const autoDeliveryPrice = normalizeProductAutoDeliveryPrice(
    product.autoDeliveryPrice,
  );

  return {
    cardId: card.cardId,
    index,
    standardPrice: Number(autoDeliveryPrice.price.replace(",", ".")) || 0,
  };
}

export function getAutomaticXtraDeliveryCardIds(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
) {
  const candidates = cards
    .map((card, index) => {
      if (!card.productId) {
        return null;
      }

      const product =
        catalogProducts.find((item) => item.id === card.productId && item.active) ??
        null;

      if (!product) {
        return null;
      }

      return getSharedDeliveryCandidate(card, product, index);
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

export function canApplyReturnOption(params: {
  allowReturnOptions: boolean;
  allowDeliveryTypes: boolean;
  deliveryType: SavedProductCard["deliveryType"];
}) {
  if (!params.allowReturnOptions) {
    return false;
  }

  if (!params.allowDeliveryTypes) {
    return true;
  }

  return params.deliveryType !== DELIVERY_TYPES.FIRST_STEP;
}
