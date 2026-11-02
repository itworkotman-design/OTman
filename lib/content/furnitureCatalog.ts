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
//   prices, 25% off for the customer, with the normal extra-item rate for a
//   2nd+ one (withLighterHeavyDelivery below).

import { FURNITURE_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";
import type { WeightClass } from "@/lib/products/weightClass";

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

// Dining set, Sofa and Sofa bed (the source's "Side-by-Side" heavy items) are
// sold at 25% below the source's customer price, and a 2nd+ one costs the same
// extra-item rate as any other furniture instead of the full price again
// (decided 2026-11-02). Partner prices for the first item are unchanged. Done
// here rather than in the generated data file so a regeneration keeps it.
const HEAVY_PRODUCT_CODES = new Set(["FN_DINING_SET", "FN_SOFA", "FN_SOFA_BED"]);
const HEAVY_CUSTOMER_PRICE_FACTOR = 0.75;
const NORMAL_XTRA_RATES = FURNITURE_PRODUCTS_DATA.find((p) => p.code === "FN_BED")!.deliveryTypes;

function withLighterHeavyDelivery(product: FurnitureProductSeed): FurnitureProductSeed {
  if (!HEAVY_PRODUCT_CODES.has(product.code)) return product;
  const { firstStep, indoor } = product.deliveryTypes;
  return {
    ...product,
    deliveryTypes: {
      ...product.deliveryTypes,
      firstStep: {
        ...firstStep,
        customerPrice: firstStep.customerPrice * HEAVY_CUSTOMER_PRICE_FACTOR,
        xtraPrice: NORMAL_XTRA_RATES.firstStep.xtraPrice,
        xtraSubcontractorPrice: NORMAL_XTRA_RATES.firstStep.xtraSubcontractorPrice,
      },
      indoor: {
        ...indoor,
        customerPrice: indoor.customerPrice * HEAVY_CUSTOMER_PRICE_FACTOR,
        xtraPrice: NORMAL_XTRA_RATES.indoor.xtraPrice,
        xtraSubcontractorPrice: NORMAL_XTRA_RATES.indoor.xtraSubcontractorPrice,
      },
    },
  };
}

// Weight classes (the size-category table, decided 2026-11-02): they price
// the return and the no-lift floor surcharge (websiteWeightClass.ts). Other
// furniture has none, so it counts as light. Outdoor and Children's furniture
// are medium until an assembly type says otherwise.
const FURNITURE_WEIGHT_CLASSES: Record<string, WeightClass> = {
  FN_BED: "MEDIUM",
  FN_MATTRESS: "MEDIUM",
  FN_WARDROBE: "MEDIUM",
  FN_CHEST_OF_DRAWERS: "MEDIUM",
  FN_BOOKCASE: "MEDIUM",
  FN_SHELVING_UNIT: "MEDIUM",
  FN_CABINET: "MEDIUM",
  FN_DISPLAY_CABINET: "MEDIUM",
  FN_SIDEBOARD: "MEDIUM",
  FN_TV_BENCH: "MEDIUM",
  FN_BEDSIDE_TABLE: "LIGHT",
  FN_DINING_TABLE: "MEDIUM",
  FN_DINING_SET: "HEAVY",
  FN_CHAIR: "LIGHT",
  FN_OFFICE_CHAIR: "LIGHT",
  FN_DESK: "MEDIUM",
  FN_SOFA: "HEAVY",
  FN_SOFA_BED: "HEAVY",
  FN_ARMCHAIR_RECLINER: "MEDIUM",
  FN_COFFEE_TABLE: "LIGHT",
  FN_OUTDOOR_FURNITURE: "MEDIUM",
  FN_CHILDRENS_FURNITURE: "MEDIUM",
};

// Assembly types (typeEn) that override their product's class when picked.
const ASSEMBLY_TYPE_WEIGHT_CLASSES: Record<string, Record<string, WeightClass>> = {
  FN_OUTDOOR_FURNITURE: { "Outdoor table": "MEDIUM", "Outdoor chair": "LIGHT", "Lounge / sofa set": "HEAVY" },
  FN_CHILDRENS_FURNITURE: { "Children's bed": "MEDIUM", "Storage / cabinet": "MEDIUM", "Table + chairs set": "LIGHT" },
};

function withWeightClasses(product: FurnitureProductSeed): FurnitureProductSeed {
  const typeClasses = ASSEMBLY_TYPE_WEIGHT_CLASSES[product.code];
  const weightClass = FURNITURE_WEIGHT_CLASSES[product.code];
  return {
    ...product,
    ...(weightClass ? { weightClass } : {}),
    options: typeClasses
      ? product.options.map((option) => {
          const optionClass = option.typeEn ? typeClasses[option.typeEn] : undefined;
          return optionClass ? { ...option, weightClass: optionClass } : option;
        })
      : product.options,
  };
}

// "Other furniture" additionally gets its volume/weight size brackets (kept out
// of the generated data file — see otherFurnitureSizeOptions.ts).
export const FURNITURE_PRODUCTS: FurnitureProductSeed[] = FURNITURE_PRODUCTS_DATA.map(withLighterHeavyDelivery).map((product) => {
  const options = withSharedDismantling(withHalfPriceReturn(product.options));
  return withWeightClasses(
    product.code === OTHER_FURNITURE_PRODUCT_CODE
      ? { ...product, options: [...options, ...OTHER_FURNITURE_SIZE_OPTIONS] }
      : { ...product, options },
  );
});
