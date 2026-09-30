import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { CatalogSpecialOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceLookup } from "@/lib/booking/pricing/types";
import { OPTION_CODES } from "@/lib/booking/constants";

function parsePrice(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Catalog options are seeded with `label` = English and `description` =
// Norwegian (see seedWebsiteCatalog.ts). Defaulting to Norwegian-first (no
// `locale`, or `locale: "no"`) keeps every existing caller — the dashboard
// and server-side order-submission/email/GSM paths, all Norwegian-only —
// unchanged. Only the website order flow's on-screen summary passes
// `locale: "en"`, so an English-locale customer sees their own language
// there; what actually gets stored/emailed is untouched.
function pickLabel(
  label: string | null,
  description: string | null,
  code: string,
  locale?: "en" | "no",
): string {
  const primary = locale === "en" ? label : description;
  const fallback = locale === "en" ? description : label;
  return primary || fallback || code;
}

export function buildPriceLookup(
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
  opts?: { locale?: "en" | "no" },
): PriceLookup {
  const lookup: PriceLookup = {};
  const { locale } = opts ?? {};

  // 1. PRODUCT OPTIONS
  for (const product of catalogProducts) {
    for (const option of product.options) {
      lookup[option.id] = {
        label: pickLabel(option.label, option.description, option.code, locale),
        code: option.code,
        customerPrice: parsePrice(option.effectiveCustomerPrice),
        subcontractorPrice: parsePrice(option.subcontractorPrice),
      };
    }
  }

  // 2. SPECIAL OPTIONS (RETURN + XTRA)
  for (const option of catalogSpecialOptions) {
    lookup[option.id] = {
      label: pickLabel(option.label, option.description, option.code, locale),
      code: option.type === "xtra" ? OPTION_CODES.XTRA : option.code,
      customerPrice: parsePrice(option.effectiveCustomerPrice),
      subcontractorPrice: parsePrice(option.subcontractorPrice),
    };
  }

  return lookup;
}
