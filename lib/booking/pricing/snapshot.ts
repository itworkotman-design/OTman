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

function stableStringify(value: OrderPricingSnapshot) {
  return JSON.stringify({
    productOptions: Object.fromEntries(
      Object.entries(value.productOptions).toSorted(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    specialOptions: Object.fromEntries(
      Object.entries(value.specialOptions).toSorted(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    deliveryTypes: Object.fromEntries(
      Object.entries(value.deliveryTypes).toSorted(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    autoDeliveryPrices: Object.fromEntries(
      Object.entries(value.autoDeliveryPrices ?? {}).toSorted(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    customSectionOptions: Object.fromEntries(
      Object.entries(value.customSectionOptions).toSorted(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    priceListSettings: normalizePriceListSettings(value.priceListSettings),
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
  const productOptions: OrderPricingSnapshot["productOptions"] = {};
  const deliveryTypes: OrderPricingSnapshot["deliveryTypes"] = {};
  const autoDeliveryPrices: OrderPricingSnapshot["autoDeliveryPrices"] = {};
  const customSectionOptions: OrderPricingSnapshot["customSectionOptions"] = {};

  for (const product of catalogProducts) {
    if (!selectedProductIds.has(product.id)) {
      continue;
    }

    for (const option of product.options) {
      productOptions[option.id] = {
        customerPrice: option.customerPrice,
        subcontractorPrice: option.subcontractorPrice,
        effectiveCustomerPrice: option.effectiveCustomerPrice,
      };
    }

    for (const deliveryType of product.deliveryTypes) {
      deliveryTypes[deliveryTypeSnapshotKey(product.id, deliveryType.key)] = {
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
      catalogSpecialOptions.map((option) => [
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

  return stableStringify(left) === stableStringify(right);
}
