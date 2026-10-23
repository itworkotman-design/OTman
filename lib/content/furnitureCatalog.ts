import type {
  WhiteGoodsOptionSeed,
  WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { FURNITURE_PRODUCTS_DATA } from "@/lib/content/furnitureCatalogData";
import { OTHER_FURNITURE_PRODUCT_CODE, OTHER_FURNITURE_SIZE_OPTIONS } from "@/lib/content/otherFurnitureSizeOptions";

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
// - Dismantling comes as two shared choices (for disposal / for reuse — see
//   FURNITURE_DISMANTLING_OPTIONS) and is stackable
//   alongside any main option, assembly included.
// - Dining set, Sofa and Sofa bed use large/heavy "Side-by-Side" delivery
//   prices. A second heavy item is NOT discounted (xtraPrice = full price).

import { FURNITURE_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";

export { FURNITURE_PRICE_LIST_CODE };

// typeEn/typeNo (the type half of "Single bed — IKEA") come from WhiteGoodsOptionSeed.
export type FurnitureOptionSeed = WhiteGoodsOptionSeed & {
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

// The recycling return is sold at half the source workbook's price, partner
// price included (decided 2026-10-23). Done here rather than in the generated
// data file so a regeneration keeps it.
const HALF_PRICE_FACTOR = 0.5;

function withHalfPriceReturn(options: FurnitureOptionSeed[]): FurnitureOptionSeed[] {
  return options.map((option) =>
    option.code === "RETURN_RECYCLING"
      ? {
          ...option,
          customerPrice: option.customerPrice * HALF_PRICE_FACTOR,
          subcontractorPrice: option.subcontractorPrice * HALF_PRICE_FACTOR,
        }
      : option,
  );
}

// The source's per-type dismantling list (Single bed, Double bed, …, each for
// disposal and careful for reuse) is replaced by the same two choices on every
// product that offers dismantling: for disposal or for reuse, no sizes
// (decided 2026-10-23). Ex. VAT, multiples of 8 so incl. VAT ends in 0 (600 /
// 900 for the customer). The DISP/CAR codes are what groupDismantlingOptions
// pairs on.
export const FURNITURE_DISMANTLING_OPTIONS: FurnitureOptionSeed[] = [
  { code: "DISMANTLE_DISP_STD", category: "extra", labelEn: "Dismantling for disposal", labelNo: "Demontering for avhending", customerPrice: 480, subcontractorPrice: 335 },
  { code: "DISMANTLE_CAR_STD", category: "extra", labelEn: "Dismantling for reuse", labelNo: "Demontering for gjenbruk", customerPrice: 720, subcontractorPrice: 505 },
];

// Swaps the source's dismantling options for the two shared ones, where the
// first of them stood.
function withSharedDismantling(options: FurnitureOptionSeed[]): FurnitureOptionSeed[] {
  const first = options.findIndex((o) => o.code.startsWith("DISMANTLE_"));
  if (first < 0) return options;
  const rest = options.filter((o) => !o.code.startsWith("DISMANTLE_"));
  return [...rest.slice(0, first), ...FURNITURE_DISMANTLING_OPTIONS, ...rest.slice(first)];
}

// "Other furniture" additionally gets its volume/weight size brackets (kept out
// of the generated data file — see otherFurnitureSizeOptions.ts).
export const FURNITURE_PRODUCTS: FurnitureProductSeed[] = FURNITURE_PRODUCTS_DATA.map((product) => {
  const options = withSharedDismantling(withHalfPriceReturn(product.options));
  return product.code === OTHER_FURNITURE_PRODUCT_CODE
    ? { ...product, options: [...options, ...OTHER_FURNITURE_SIZE_OPTIONS] }
    : { ...product, options };
});
