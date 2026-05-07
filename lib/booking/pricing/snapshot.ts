import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  normalizePriceListSettings,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import {
  normalizeProductAutoDeliveryPrice,
  type ProductAutoDeliveryPrice,
} from "@/lib/products/autoDeliveryPrice";

type OptionPriceSnapshot = {
  customerPrice: string;
  subcontractorPrice: string;
  effectiveCustomerPrice: string;
};

type DeliveryTypePriceSnapshot = {
  price: string;
  subcontractorPrice?: string;
  xtraPrice: string;
  xtraSubcontractorPrice?: string;
};

type CustomSectionOptionPriceSnapshot = {
  price: string;
  subcontractorPrice?: string;
};

export type OrderPricingSnapshot = {
  productOptions: Record<string, OptionPriceSnapshot>;
  specialOptions: Record<string, OptionPriceSnapshot>;
  deliveryTypes: Record<string, DeliveryTypePriceSnapshot>;
  autoDeliveryPrices: Record<string, ProductAutoDeliveryPrice>;
  customSectionOptions: Record<string, CustomSectionOptionPriceSnapshot>;
  priceListSettings: PriceListSettings;
};

function deliveryTypeSnapshotKey(productId: string, deliveryTypeKey: string) {
  return `${productId}:${deliveryTypeKey}`;
}

function priceValueToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function normalizeOptionPriceSnapshot(value: OptionPriceSnapshot) {
  return {
    customerPriceCents: priceValueToCents(value.customerPrice),
    subcontractorPriceCents: priceValueToCents(value.subcontractorPrice),
    effectiveCustomerPriceCents: priceValueToCents(value.effectiveCustomerPrice),
  };
}

function normalizeDeliveryTypePriceSnapshot(value: DeliveryTypePriceSnapshot) {
  return {
    priceCents: priceValueToCents(value.price),
    subcontractorPriceCents: priceValueToCents(value.subcontractorPrice),
    xtraPriceCents: priceValueToCents(value.xtraPrice),
    xtraSubcontractorPriceCents: priceValueToCents(
      value.xtraSubcontractorPrice,
    ),
  };
}

function normalizeCustomSectionOptionPriceSnapshot(
  value: CustomSectionOptionPriceSnapshot,
) {
  return {
    priceCents: priceValueToCents(value.price),
    subcontractorPriceCents: priceValueToCents(value.subcontractorPrice),
  };
}

function normalizeAutoDeliveryPrice(value: ProductAutoDeliveryPrice) {
  return {
    ...normalizeProductAutoDeliveryPrice(value),
    price: priceValueToCents(value.price),
    subcontractorPrice: priceValueToCents(value.subcontractorPrice),
  };
}

function normalizeChargeSettingForCompare(value: {
  code: string;
  description: string;
  price: string;
  subcontractorPrice: string;
}) {
  return {
    code: value.code,
    description: value.description,
    priceCents: priceValueToCents(value.price),
    subcontractorPriceCents: priceValueToCents(value.subcontractorPrice),
  };
}

function normalizePriceListSettingsForCompare(value: PriceListSettings) {
  const normalized = normalizePriceListSettings(value);

  return {
    extraPickup: normalizeChargeSettingForCompare(normalized.extraPickup),
    expressDelivery: normalizeChargeSettingForCompare(normalized.expressDelivery),
    xtraPallet: normalizeChargeSettingForCompare(normalized.xtraPallet),
    kmFrom21: normalizeChargeSettingForCompare(normalized.kmFrom21),
    kmOver100: normalizeChargeSettingForCompare(normalized.kmOver100),
    deviations: Object.fromEntries(
      Object.entries(normalized.deviations)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, setting]) => [
          key,
          normalizeChargeSettingForCompare(setting),
        ]),
    ),
  };
}

function normalizeRecordForCompare<T>(
  value: Record<string, T>,
  keys: string[],
  normalize: (item: T) => unknown,
) {
  return Object.fromEntries(
    keys
      .toSorted((a, b) => a.localeCompare(b))
      .map((key) => [key, value[key] ? normalize(value[key]) : null]),
  );
}

function stableStringify(
  value: OrderPricingSnapshot,
  keySource: OrderPricingSnapshot,
) {
  return JSON.stringify({
    productOptions: normalizeRecordForCompare(
      value.productOptions,
      Object.keys(keySource.productOptions),
      normalizeOptionPriceSnapshot,
    ),
    specialOptions: normalizeRecordForCompare(
      value.specialOptions,
      Object.keys(keySource.specialOptions),
      normalizeOptionPriceSnapshot,
    ),
    deliveryTypes: normalizeRecordForCompare(
      value.deliveryTypes,
      Object.keys(keySource.deliveryTypes),
      normalizeDeliveryTypePriceSnapshot,
    ),
    autoDeliveryPrices: normalizeRecordForCompare(
      value.autoDeliveryPrices ?? {},
      Object.keys(keySource.autoDeliveryPrices ?? {}),
      normalizeAutoDeliveryPrice,
    ),
    customSectionOptions: normalizeRecordForCompare(
      value.customSectionOptions,
      Object.keys(keySource.customSectionOptions),
      normalizeCustomSectionOptionPriceSnapshot,
    ),
    priceListSettings: normalizePriceListSettingsForCompare(
      value.priceListSettings,
    ),
  });
}

export function buildOrderPricingSnapshot(params: {
  productCards: SavedProductCard[];
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
  priceListSettings: PriceListSettings;
}): OrderPricingSnapshot {
  const { productCards, catalogProducts, catalogSpecialOptions } = params;
  const selectedProductIds = new Set(
    productCards
      .map((card) => card.productId)
      .filter((productId): productId is string => typeof productId === "string"),
  );
  const selectedProductOptionIds = new Set<string>();
  const selectedSpecialOptionIds = new Set<string>();
  const selectedCustomSectionOptionIds = new Set<string>();
  const selectedDeliveryTypeKeys = new Set<string>();
  const productOptions: OrderPricingSnapshot["productOptions"] = {};
  const deliveryTypes: OrderPricingSnapshot["deliveryTypes"] = {};
  const autoDeliveryPrices: OrderPricingSnapshot["autoDeliveryPrices"] = {};
  const customSectionOptions: OrderPricingSnapshot["customSectionOptions"] = {};

  for (const card of productCards) {
    if (!card.productId) {
      continue;
    }

    for (const optionId of [
      ...card.selectedInstallOptionIds,
      ...card.selectedExtraOptionIds,
      ...card.selectedTimeOptionIds,
    ]) {
      selectedProductOptionIds.add(optionId);
      selectedSpecialOptionIds.add(optionId);
    }

    if (card.selectedReturnOptionId) {
      selectedSpecialOptionIds.add(card.selectedReturnOptionId);
    }

    if (card.deliveryType) {
      selectedDeliveryTypeKeys.add(
        deliveryTypeSnapshotKey(card.productId, card.deliveryType),
      );
    }

    for (const selection of card.customSectionSelections) {
      for (const optionId of selection.optionIds) {
        selectedCustomSectionOptionIds.add(optionId);
      }
    }
  }

  for (const product of catalogProducts) {
    if (!selectedProductIds.has(product.id)) {
      continue;
    }

    for (const option of product.options) {
      if (!selectedProductOptionIds.has(option.id)) {
        continue;
      }

      productOptions[option.id] = {
        customerPrice: option.customerPrice,
        subcontractorPrice: option.subcontractorPrice,
        effectiveCustomerPrice: option.effectiveCustomerPrice,
      };
    }

    for (const deliveryType of product.deliveryTypes) {
      const key = deliveryTypeSnapshotKey(product.id, deliveryType.key);

      if (!selectedDeliveryTypeKeys.has(key)) {
        continue;
      }

      deliveryTypes[key] = {
        price: deliveryType.price,
        subcontractorPrice: deliveryType.subcontractorPrice,
        xtraPrice: deliveryType.xtraPrice,
        xtraSubcontractorPrice: deliveryType.xtraSubcontractorPrice,
      };
    }

    autoDeliveryPrices[product.id] = normalizeProductAutoDeliveryPrice(
      product.autoDeliveryPrice,
    );

    for (const section of product.customSections) {
      for (const option of section.options) {
        if (!selectedCustomSectionOptionIds.has(option.id)) {
          continue;
        }

        customSectionOptions[option.id] = {
          price: option.price,
          subcontractorPrice: option.subcontractorPrice,
        };
      }
    }
  }

  return {
    productOptions,
    specialOptions: Object.fromEntries(
      catalogSpecialOptions
        .filter((option) => selectedSpecialOptionIds.has(option.id))
        .map((option) => [
          option.id,
          {
            customerPrice: option.customerPrice,
            subcontractorPrice: option.subcontractorPrice,
            effectiveCustomerPrice: option.effectiveCustomerPrice,
          },
        ]),
    ),
    deliveryTypes,
    autoDeliveryPrices,
    customSectionOptions,
    priceListSettings: normalizePriceListSettings(params.priceListSettings),
  };
}

export function applyOrderPricingSnapshot(params: {
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
  priceListSettings: PriceListSettings;
  pricingSnapshot: OrderPricingSnapshot | null | undefined;
}) {
  const { pricingSnapshot } = params;

  if (!pricingSnapshot) {
    return {
      catalogProducts: params.catalogProducts,
      catalogSpecialOptions: params.catalogSpecialOptions,
      priceListSettings: params.priceListSettings,
    };
  }

  return {
    catalogProducts: params.catalogProducts.map((product) => ({
      ...product,
      autoDeliveryPrice: normalizeProductAutoDeliveryPrice(
        pricingSnapshot.autoDeliveryPrices?.[product.id] ??
          product.autoDeliveryPrice,
      ),
      deliveryTypes: product.deliveryTypes.map((deliveryType) => {
        const snapshot =
          pricingSnapshot.deliveryTypes[
            deliveryTypeSnapshotKey(product.id, deliveryType.key)
          ];

        return snapshot
          ? {
              ...deliveryType,
              price: snapshot.price,
              subcontractorPrice:
                snapshot.subcontractorPrice ?? deliveryType.subcontractorPrice,
              xtraPrice: snapshot.xtraPrice,
              xtraSubcontractorPrice:
                snapshot.xtraSubcontractorPrice ??
                deliveryType.xtraSubcontractorPrice,
            }
          : deliveryType;
      }),
      options: product.options.map((option) => {
        const snapshot = pricingSnapshot.productOptions[option.id];

        return snapshot
          ? {
              ...option,
              customerPrice: snapshot.customerPrice,
              subcontractorPrice: snapshot.subcontractorPrice,
              effectiveCustomerPrice: snapshot.effectiveCustomerPrice,
            }
          : option;
      }),
      customSections: product.customSections.map((section) => ({
        ...section,
        options: section.options.map((option) => {
          const snapshot = pricingSnapshot.customSectionOptions[option.id];

          return snapshot
            ? {
                ...option,
                price: snapshot.price,
                subcontractorPrice:
                  snapshot.subcontractorPrice ?? option.subcontractorPrice,
              }
            : option;
        }),
      })),
    })),
    catalogSpecialOptions: params.catalogSpecialOptions.map((option) => {
      const snapshot = pricingSnapshot.specialOptions[option.id];

      return snapshot
        ? {
            ...option,
            customerPrice: snapshot.customerPrice,
            subcontractorPrice: snapshot.subcontractorPrice,
            effectiveCustomerPrice: snapshot.effectiveCustomerPrice,
          }
        : option;
    }),
    priceListSettings: normalizePriceListSettings(
      pricingSnapshot.priceListSettings,
    ),
  };
}

export function getSavedOrderPricingSnapshot(productCards: SavedProductCard[]) {
  return (
    productCards.find((card) => card.pricingSnapshot)?.pricingSnapshot ?? null
  );
}

export function pricingSnapshotsEqual(
  left: OrderPricingSnapshot | null | undefined,
  right: OrderPricingSnapshot | null | undefined,
) {
  if (!left || !right) {
    return left === right;
  }

  return stableStringify(left, right) === stableStringify(right, right);
}
