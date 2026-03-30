import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceLookup } from "./types";

export function buildPriceLookup(products: CatalogProduct[]): PriceLookup {
  const lookup: PriceLookup = {};

  for (const product of products) {
    for (const option of product.options) {
      lookup[option.id] = {
        label: option.description || option.label,
        code: option.code,
        customerPrice: Number(option.effectiveCustomerPrice || 0),
        subcontractorPrice: Number(option.subcontractorPrice || 0),
      };
    }
  }

  return lookup;
}
