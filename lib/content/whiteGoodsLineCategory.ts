import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "./whiteGoodsElectronics";

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

  for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
    const option = product.options.find((o) => o.code === code);
    if (option) return option.category === "install" ? "install" : "other";
  }

  return "other";
}
