import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { CatalogSpecialOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceLookup } from "@/lib/booking/pricing/types";

function parsePrice(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildPriceLookup(
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): PriceLookup {
  const lookup: PriceLookup = {};

  // 1. PRODUCT OPTIONS
  for (const product of catalogProducts) {
    for (const option of product.options) {
      lookup[option.id] = {
        label: option.description || option.label || option.code,
        code: option.code,
        customerPrice: parsePrice(option.effectiveCustomerPrice),
        subcontractorPrice: parsePrice(option.subcontractorPrice),
      };
    }
  }

  // 2. SPECIAL OPTIONS (RETURN + XTRA)
  for (const option of catalogSpecialOptions) {
    lookup[option.id] = {
      label: option.description || option.label || option.code,
      code: option.code,
      customerPrice: parsePrice(option.effectiveCustomerPrice),
      subcontractorPrice: parsePrice(option.subcontractorPrice),
    };
  }

  return lookup;
}
