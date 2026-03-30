import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceLookup } from "@/lib/booking/pricing/types";
import { OPTION_CODES, OPTION_CATEGORIES } from "@/lib/booking/constants";

function parsePrice(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanLabel(
  description: string | null | undefined,
  fallback: string | null | undefined,
  code: string | null | undefined,
) {
  const raw = (description ?? fallback ?? "").trim();
  const normalizedCode = (code ?? "").trim();

  if (!raw) return "";

  if (!normalizedCode) return raw;

  const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return raw
    .replace(new RegExp(`\\(${escapedCode}\\)`, "gi"), "")
    .replace(new RegExp(`\\b${escapedCode}\\b`, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
        label: cleanLabel(option.description, option.label, option.code),
        code: option.code,
        customerPrice: parsePrice(option.effectiveCustomerPrice),
        subcontractorPrice: parsePrice(option.subcontractorPrice),
      };
    }
  }

  return lookup;
}
