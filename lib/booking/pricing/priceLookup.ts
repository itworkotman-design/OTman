import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceLookup } from "@/lib/booking/pricing/types";
import { OPTION_CODES, OPTION_CATEGORIES } from "@/lib/booking/constants";

function parsePrice(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildOptionLabel(option: CatalogProduct["options"][number]) {
  const base = option.description?.trim() || option.label.trim();
  const code = option.code?.trim();

  if (!code) return base;
  return `${base} (${code})`;
}

export function findReturnOptions(catalogProducts: CatalogProduct[]) {
  const results: string[] = [];

  for (const product of catalogProducts) {
    for (const option of product.options) {
      const category = (option.category ?? "").trim().toLowerCase();

      if (category === OPTION_CATEGORIES.RETURN) {
        results.push(option.id);
      }
    }
  }

  return results;
}

export function findXtraOptionId(
  catalogProducts: CatalogProduct[],
): string | null {
  for (const product of catalogProducts) {
    for (const option of product.options) {
      const code = (option.code ?? "").trim().toUpperCase();
      const category = (option.category ?? "").trim().toLowerCase();

      if (code === OPTION_CODES.XTRA || category === OPTION_CATEGORIES.XTRA) {
        return option.id;
      }
    }
  }

  return null;
}

export function buildPriceLookup(
  catalogProducts: CatalogProduct[],
): PriceLookup {
  const lookup: PriceLookup = {};

  for (const product of catalogProducts) {
    for (const option of product.options) {
      lookup[option.id] = {
        label: buildOptionLabel(option),
        customerPrice: parsePrice(option.effectiveCustomerPrice),
        subcontractorPrice: parsePrice(option.subcontractorPrice),
      };
    }
  }

  return lookup;
}
