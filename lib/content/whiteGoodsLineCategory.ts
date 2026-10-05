import { WEBSITE_CATALOGS } from "./websiteCatalogs";
import { shortenCatalogCode } from "./shortCatalogCode";

export type WhiteGoodsLineCategory = "delivery" | "install" | "other";

// Classifies a priced line (by its option/delivery-type code) for the
// order-summary panel's icon — delivery-type codes are global, install-type
// codes are per-product but only ever tagged "install" in the seed data, so
// a code-only lookup across every product is enough without knowing which
// product the line came from.
export function categorizeWhiteGoodsLineCode(code: string | undefined): WhiteGoodsLineCategory {
  // XTRA is the extra-delivery line (each additional unit / later card).
  if (code === "FIRST_STEP" || code === "INDOOR" || code === "XTRA") return "delivery";
  if (!code) return "other";

  // Old long codes (stored before the catalog was reseeded) match too.
  const short = shortenCatalogCode(code);
  for (const catalog of WEBSITE_CATALOGS) {
    for (const product of catalog.products) {
      const option = product.options.find((o) => o.code === short);
      if (option) return option.category === "install" ? "install" : "other";
    }
  }

  return "other";
}
