import {
  createEmptyProductCard,
  type CatalogOption,
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { OPTION_CODES } from "@/lib/booking/constants";
import type { DeliveryType } from "@/lib/booking/pricing/types";
import {
  WORDPRESS_DELIVERY_TYPE_ALIASES,
  WORDPRESS_PRODUCT_MAPPINGS,
  WORDPRESS_SPECIAL_SERVICE_ALIASES,
  type WordpressProductMapping,
} from "@/lib/integrations/wordpress/catalogMappingConfig";

export type WordpressParsedProduct = {
  cardId: number;
  productName: string;
  quantity: number;
  deliveryType?: string;
};

export type WordpressParsedService = {
  cardId: number;
  productName: string;
  quantity: number;
  itemType: "INSTALL_OPTION" | "RETURN_OPTION" | "EXTRA_OPTION";
  label: string;
  code?: string;
};

export type ResolvedWordpressService = WordpressParsedService & {
  resolvedItemType: "INSTALL_OPTION" | "RETURN_OPTION" | "EXTRA_OPTION";
  optionId: string | null;
  optionCode: string;
  optionLabel: string | null;
  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;
};

export type WordpressCatalogMappingResult = {
  productCards: SavedProductCard[];
  resolvedServices: ResolvedWordpressService[];
  unresolvedProducts: WordpressParsedProduct[];
  unresolvedServices: WordpressParsedService[];
};

const LEGACY_ENCODING_REPLACEMENTS: Array<[string, string]> = [
  ["Ã¸", "o"],
  ["Ã¥", "a"],
  ["Ã¦", "ae"],
  ["Ã˜", "o"],
  ["Ã…", "a"],
  ["Ã†", "ae"],
  ["ø", "o"],
  ["å", "a"],
  ["æ", "ae"],
];

function repairLegacyEncoding(value: string): string {
  return LEGACY_ENCODING_REPLACEMENTS.reduce(
    (currentValue, [from, to]) => currentValue.replaceAll(from, to),
    value,
  );
}

function normalizeKey(value: string | null | undefined): string {
  return repairLegacyEncoding(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesAlias(
  value: string | null | undefined,
  aliases: readonly string[],
): boolean {
  const normalizedValue = normalizeKey(value);
  if (!normalizedValue) return false;

  return aliases.some((alias) => normalizeKey(alias) === normalizedValue);
}

function decimalStringToCents(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function pushUnique(target: string[], value: string | null | undefined) {
  if (!value) return;
  if (!target.includes(value)) {
    target.push(value);
  }
}

function getProductMapping(product: CatalogProduct): WordpressProductMapping | null {
  return (
    WORDPRESS_PRODUCT_MAPPINGS.find((mapping) =>
      matchesAlias(product.label, mapping.catalogAliases),
    ) ?? null
  );
}

function resolveCatalogProduct(
  legacyProductName: string,
  catalogProducts: CatalogProduct[],
): CatalogProduct | null {
  const normalizedLegacy = normalizeKey(legacyProductName);
  if (!normalizedLegacy) return null;

  const exact = catalogProducts.find(
    (product) => normalizeKey(product.label) === normalizedLegacy,
  );
  if (exact) return exact;

  const aliasMatch = catalogProducts.find((product) =>
    matchesAlias(legacyProductName, getProductMapping(product)?.wordpressAliases ?? []),
  );

  return aliasMatch ?? null;
}

function resolveDeliveryType(value: string | undefined): DeliveryType {
  const normalizedValue = normalizeKey(value);
  if (!normalizedValue) return "";

  for (const [deliveryType, aliases] of Object.entries(
    WORDPRESS_DELIVERY_TYPE_ALIASES,
  ) as Array<[DeliveryType, string[]]>) {
    if (matchesAlias(normalizedValue, aliases)) {
      return deliveryType;
    }
  }

  return "";
}

function findProductOption(
  product: CatalogProduct,
  optionCode: string,
): CatalogOption | null {
  return (
    product.options.find(
      (option) => normalizeKey(option.code) === normalizeKey(optionCode),
    ) ?? null
  );
}

function findSpecialOption(
  catalogSpecialOptions: CatalogSpecialOption[],
  optionCode: string,
): CatalogSpecialOption | null {
  return (
    catalogSpecialOptions.find(
      (option) => normalizeKey(option.code) === normalizeKey(optionCode),
    ) ?? null
  );
}

function resolveInstallAlias(
  product: CatalogProduct,
  service: WordpressParsedService,
): string | null {
  const mapping = getProductMapping(product);
  if (!mapping?.installAliases?.length) {
    return null;
  }

  for (const installAlias of mapping.installAliases) {
    const hasAliasMatch =
      matchesAlias(service.code, installAlias.aliases) ||
      matchesAlias(service.label, installAlias.aliases);

    if (hasAliasMatch) {
      return installAlias.optionCode;
    }
  }

  return null;
}

function buildResolvedService(params: {
  service: WordpressParsedService;
  resolvedItemType: ResolvedWordpressService["resolvedItemType"];
  optionId: string | null;
  optionCode: string;
  optionLabel: string | null;
  customerPrice: string | null | undefined;
  subcontractorPrice: string | null | undefined;
}): ResolvedWordpressService {
  const {
    service,
    resolvedItemType,
    optionId,
    optionCode,
    optionLabel,
    customerPrice,
    subcontractorPrice,
  } = params;

  return {
    ...service,
    resolvedItemType,
    optionId,
    optionCode,
    optionLabel,
    customerPriceCents: decimalStringToCents(customerPrice),
    subcontractorPriceCents: decimalStringToCents(subcontractorPrice),
  };
}

function resolveSpecialServiceCode(service: WordpressParsedService): string | null {
  const aliasCodeEntry = Object.entries(WORDPRESS_SPECIAL_SERVICE_ALIASES).find(
    ([, aliases]) =>
      matchesAlias(service.code, aliases) || matchesAlias(service.label, aliases),
  );

  return aliasCodeEntry?.[0] ?? null;
}

function resolveService(
  service: WordpressParsedService,
  product: CatalogProduct,
  catalogSpecialOptions: CatalogSpecialOption[],
): ResolvedWordpressService | null {
  if (service.code) {
    const productOption = findProductOption(product, service.code);
    if (productOption) {
      const resolvedItemType =
        normalizeKey(productOption.code) === normalizeKey(OPTION_CODES.DEMONT)
          ? "EXTRA_OPTION"
          : "INSTALL_OPTION";

      if (
        resolvedItemType === "EXTRA_OPTION" &&
        normalizeKey(productOption.code) === normalizeKey(OPTION_CODES.DEMONT) &&
        !product.allowDemont
      ) {
        return null;
      }

      return buildResolvedService({
        service,
        resolvedItemType,
        optionId: productOption.id,
        optionCode: productOption.code,
        optionLabel: productOption.label,
        customerPrice: productOption.customerPrice,
        subcontractorPrice: productOption.subcontractorPrice,
      });
    }

    const specialOption = findSpecialOption(catalogSpecialOptions, service.code);
    if (specialOption) {
      return buildResolvedService({
        service,
        resolvedItemType:
          specialOption.type === "return" ? "RETURN_OPTION" : "EXTRA_OPTION",
        optionId: specialOption.id,
        optionCode: specialOption.code,
        optionLabel: specialOption.label,
        customerPrice: specialOption.customerPrice,
        subcontractorPrice: specialOption.subcontractorPrice,
      });
    }
  }

  const installAliasCode = resolveInstallAlias(product, service);
  if (installAliasCode) {
    const installOption = findProductOption(product, installAliasCode);
    if (!installOption) {
      return null;
    }

    return buildResolvedService({
      service,
      resolvedItemType: "INSTALL_OPTION",
      optionId: installOption.id,
      optionCode: installOption.code,
      optionLabel: installOption.label,
      customerPrice: installOption.customerPrice,
      subcontractorPrice: installOption.subcontractorPrice,
    });
  }

  const specialAliasCode = resolveSpecialServiceCode(service);
  if (!specialAliasCode) {
    return null;
  }

  if (normalizeKey(specialAliasCode) === normalizeKey(OPTION_CODES.DEMONT)) {
    if (!product.allowDemont) {
      return null;
    }

    const demontOption = findProductOption(product, specialAliasCode);
    if (!demontOption) {
      return null;
    }

    return buildResolvedService({
      service,
      resolvedItemType: "EXTRA_OPTION",
      optionId: demontOption.id,
      optionCode: demontOption.code,
      optionLabel: demontOption.label,
      customerPrice: demontOption.customerPrice,
      subcontractorPrice: demontOption.subcontractorPrice,
    });
  }

  const specialOption = findSpecialOption(catalogSpecialOptions, specialAliasCode);
  if (!specialOption) {
    return null;
  }

  return buildResolvedService({
    service,
    resolvedItemType:
      specialOption.type === "return" ? "RETURN_OPTION" : "EXTRA_OPTION",
    optionId: specialOption.id,
    optionCode: specialOption.code,
    optionLabel: specialOption.label,
    customerPrice: specialOption.customerPrice,
    subcontractorPrice: specialOption.subcontractorPrice,
  });
}

export function mapWordpressImportToProductCards(params: {
  parsedProducts: WordpressParsedProduct[];
  parsedServices: WordpressParsedService[];
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
}): WordpressCatalogMappingResult {
  const {
    parsedProducts,
    parsedServices,
    catalogProducts,
    catalogSpecialOptions,
  } = params;

  const productCards: SavedProductCard[] = [];
  const resolvedServices: ResolvedWordpressService[] = [];
  const unresolvedProducts: WordpressParsedProduct[] = [];
  const unresolvedServices: WordpressParsedService[] = [];

  for (const parsedProduct of parsedProducts) {
    const product = resolveCatalogProduct(parsedProduct.productName, catalogProducts);

    if (!product) {
      unresolvedProducts.push(parsedProduct);
      unresolvedServices.push(
        ...parsedServices.filter((service) => service.cardId === parsedProduct.cardId),
      );
      continue;
    }

    const card = createEmptyProductCard(parsedProduct.cardId);
    card.productId = product.id;
    card.amount = parsedProduct.quantity;

    const productServices = parsedServices.filter(
      (service) => service.cardId === parsedProduct.cardId,
    );

    const inferredDeliveryType =
      resolveDeliveryType(parsedProduct.deliveryType) ||
      (productServices.some((service) => service.itemType === "INSTALL_OPTION")
        ? "INSTALL_ONLY"
        : productServices.some((service) => service.itemType === "RETURN_OPTION")
          ? "RETURN_ONLY"
          : "");

    if (product.allowDeliveryTypes) {
      card.deliveryType = inferredDeliveryType;
    }

    for (const service of productServices) {
      const resolvedService = resolveService(
        service,
        product,
        catalogSpecialOptions,
      );

      if (!resolvedService) {
        unresolvedServices.push(service);
        continue;
      }

      if (
        normalizeKey(resolvedService.optionCode) === normalizeKey(OPTION_CODES.DEMONT)
      ) {
        card.demontEnabled = true;
        resolvedServices.push(resolvedService);
        continue;
      }

      if (resolvedService.resolvedItemType === "INSTALL_OPTION") {
        if (!product.allowInstallOptions || !resolvedService.optionId) {
          unresolvedServices.push(service);
          continue;
        }

        pushUnique(card.selectedInstallOptionIds, resolvedService.optionId);
        resolvedServices.push(resolvedService);
        continue;
      }

      if (resolvedService.resolvedItemType === "RETURN_OPTION") {
        if (!product.allowReturnOptions || !resolvedService.optionId) {
          unresolvedServices.push(service);
          continue;
        }

        card.selectedReturnOptionId = resolvedService.optionId;
        resolvedServices.push(resolvedService);
        continue;
      }

      if (!product.allowExtraServices || !resolvedService.optionId) {
        unresolvedServices.push(service);
        continue;
      }

      pushUnique(card.selectedExtraOptionIds, resolvedService.optionId);
      resolvedServices.push(resolvedService);
    }

    productCards.push(card);
  }

  return {
    productCards,
    resolvedServices,
    unresolvedProducts,
    unresolvedServices,
  };
}
