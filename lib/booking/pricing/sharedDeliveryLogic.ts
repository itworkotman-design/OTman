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

function isSharedDeliveryPricingType(
  deliveryType: SavedProductCard["deliveryType"],
) {
  return isTransportDeliveryType(deliveryType) || deliveryType === DELIVERY_TYPES.INSTALL_ONLY;
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

function usesSharedDeliveryPricing(
  card: SavedProductCard,
  product: CatalogProduct,
) {
  if (!product.allowDeliveryTypes) {
    return false;
  }

  return isSharedDeliveryPricingType(card.deliveryType);
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
  deliveryType: SavedProductCard["deliveryType"];
  standardPrice: number;
};

function getSharedDeliveryCandidate(
  card: SavedProductCard,
  product: CatalogProduct,
  index: number,
): SharedDeliveryCandidate | null {
  if (usesSharedDeliveryPricing(card, product)) {
    return {
      cardId: card.cardId,
      index,
      deliveryType: card.deliveryType,
      standardPrice: getProductDeliveryTypePrice({
        deliveryTypes: product.deliveryTypes,
        key: card.deliveryType,
      }),
    };
  }

  // A card that hasn't picked a delivery type yet still competes for
  // "who keeps full price" — at a price of 0, so it never outranks a card
  // with a real selection (an actual delivery line only ever gets charged
  // once a real type is picked, in buildItemsForCard), but it still lets the
  // OTHER cards' preview correctly show "extra" the moment this card exists,
  // instead of waiting for this card's own buttons to be clicked.
  if (card.deliveryType === "" && product.allowDeliveryTypes) {
    return {
      cardId: card.cardId,
      index,
      deliveryType: card.deliveryType,
      standardPrice: 0,
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
    deliveryType: card.deliveryType,
    standardPrice: Number(autoDeliveryPrice.price.replace(",", ".")) || 0,
  };
}

function getMainSharedDeliveryCandidate(
  candidates: SharedDeliveryCandidate[],
) {
  // An install-only visit represents a real, separate dispatch cost on
  // price lists where it's actually priced (the dashboard's default 590) —
  // it should never get discounted away just because another item in the
  // order is nominally "pricier", so it unconditionally keeps the main/full
  // price slot there. But price lists that price INSTALL_ONLY at 0 (the
  // website's white-goods catalog — there's no separate visit cost, since
  // installing something the customer already owns doesn't need transport)
  // have nothing to protect: letting a $0 candidate claim "main" here would
  // just wrongly discount whatever real delivery exists elsewhere in the
  // order.
  const installOnlyCandidate = candidates.find(
    (candidate) =>
      candidate.deliveryType === DELIVERY_TYPES.INSTALL_ONLY && candidate.standardPrice > 0,
  );

  if (installOnlyCandidate) {
    return installOnlyCandidate;
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

  return mainCandidate;
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

  const mainCandidate = getMainSharedDeliveryCandidate(candidates);

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
