import type { DeliveryType } from "@/lib/booking/pricing/types";
import {
  isInstallOption,
  isReturnOption,
  isXtraOption,
  isExtraCheckboxOption,
} from "@/lib/booking/pricing/rules";
import type { CatalogOption, CatalogProduct } from "./productCard";

export function hasCategorizedInstallOptions(product: CatalogProduct | null) {
  return (product?.options ?? []).some((o) => isInstallOption(o.category, o.code));
}

// Products without delivery types and no install-categorized options show their
// plain options as a "Choose" list in the install section instead.
export function getProductInstallOptions(
  product: CatalogProduct | null,
): CatalogOption[] {
  const options = product?.options ?? [];

  if (!product?.allowDeliveryTypes && !hasCategorizedInstallOptions(product)) {
    return options.filter(
      (o) =>
        o.active &&
        !isReturnOption(o.category, o.code) &&
        !isXtraOption(o.category, o.code) &&
        !isExtraCheckboxOption(o.code),
    );
  }

  return options.filter((o) => isInstallOption(o.category, o.code));
}

// When a product only has a single install option, it starts out selected.
export function getDefaultInstallOptionIds(
  product: CatalogProduct | null,
  deliveryType: DeliveryType,
): string[] {
  if (!product?.allowInstallOptions) return [];

  if (product.allowDeliveryTypes) {
    const config = product.deliveryTypes.find(
      (dt) => dt.enabled && dt.key === deliveryType,
    );
    if (!config?.allowInstallOptions) return [];
  }

  const installOptions = getProductInstallOptions(product);
  if (installOptions.length !== 1 || !installOptions[0].active) return [];

  return [installOptions[0].id];
}
