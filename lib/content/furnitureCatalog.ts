import type {
  WhiteGoodsOptionSeed,
  WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { FURNITURE_PRODUCTS_DATA } from "@/lib/content/furnitureCatalogData";

// Website furniture catalog ("WEBSITE_FURNITURE" price list). Source:
// "Otman_furniture_product_options_2026_FINAL(2).xlsx". The product/option data
// lives in furnitureCatalogData.ts, GENERATED from that workbook by
// scripts/generate-furniture-catalog-data.ts — regenerate rather than editing
// it by hand. Same shape as the white-goods seed (WhiteGoodsProductSeed) so the
// two catalogs share one seeding routine (seedWebsiteCatalog).
//
// Differences from white goods, all expressed in this data:
// - Assembly is a type + manufacturer choice ("Single bed — IKEA"), each with a
//   fixed price. They are the exclusive "type" options; typeEn/manufacturer let
//   the UI group them into a two-step pick. As with white goods, the option
//   price is the *assembly-only* number and delivery + assembly = carry-in + it
//   (`combinedWithIndoorInstall` is kept only so a test can prove that).
// - Dismantling comes in two paid variants per type (for disposal / careful for
//   reuse) and is stackable alongside any main option, assembly included.
// - Dining set, Sofa and Sofa bed use large/heavy "Side-by-Side" delivery
//   prices. A second heavy item is NOT discounted (xtraPrice = full price).

import { FURNITURE_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";

export { FURNITURE_PRICE_LIST_CODE };

export type FurnitureOptionSeed = WhiteGoodsOptionSeed & {
  /** Assembly options only: the type half of "Single bed — IKEA". */
  typeEn?: string;
  typeNo?: string;
  /** Assembly options only: the manufacturer half of "Single bed — IKEA". */
  manufacturer?: string;
  manufacturerNo?: string;
};

export type FurnitureProductSeed = Omit<WhiteGoodsProductSeed, "options"> & {
  options: FurnitureOptionSeed[];
  /**
   * Set when a part of this product can't be booked online yet (Other furniture
   * needs a manual quote for assembly). The UI shows this text where the
   * assembly choices would be, as a disabled note. Never seeded as a priced
   * option, so it can't be selected or charged.
   */
  needsImplementation?: { labelEn: string; labelNo: string };
};

export const FURNITURE_PRODUCTS: FurnitureProductSeed[] = FURNITURE_PRODUCTS_DATA;
