import type { FurnitureOptionSeed } from "@/lib/content/furnitureCatalog";
import { SIZE_VOLUME_CATEGORY, SIZE_WEIGHT_CATEGORY } from "@/lib/booking/pricing/sizeBrackets";
import { VOLUME_BRACKET_MAX_M3 } from "@/lib/booking/pricing/sizeDimensions";
import { LARGE_DELIVERY_OPTION_CODES, SIZE_LARGE_DELIVERY_CATEGORY } from "@/lib/booking/pricing/websiteSizeTier";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "@/lib/content/whiteGoodsElectronics";
import type { WeightClass } from "@/lib/products/weightClass";

// Volume (m³) and weight (kg) brackets for website furniture "Other furniture"
// (FN_OTHER_FURNITURE, "Andre møbler") — the catch-all product priced by how
// big and heavy the item is. The customer picks one of each: up to 1.5 m³ and
// 50 kg it's a small item delivered at the product's own prices (the oven's);
// over either, a large one delivered at its own large-item prices (the
// side-by-side fridge's) and priced as HEAVY — see
// lib/booking/pricing/websiteSizeTier.ts. Kept here rather than in
// furnitureCatalogData.ts because that file is GENERATED from the source
// workbook and would lose them on regeneration; furnitureCatalog.ts merges
// these in.
//
// The customer does not pick the volume bracket: they choose width, height and
// length and the volume (m³) is calculated, then placed in a bracket
// (sizeDimensions.ts). So the volume brackets here are GENERATED from
// VOLUME_BRACKET_MAX_M3 — the one table that decides where each bracket ends —
// and can't drift from it. The weight brackets are still picked directly.
//
// The brackets themselves are 0 kr (a price staff give one is still added on
// top — sizeBrackets.ts) and `staffPriced`, so a reseed leaves staff-entered
// prices alone. Moving a boundary is a code change in VOLUME_BRACKET_MAX_M3 /
// the weight list below. Anything larger than the top volume bracket (4 m³)
// needs a manual quote (no bracket = not bookable online).

type Bracket = { code: string; labelEn: string; labelNo: string; weightClass: WeightClass };

// Up to 1.5 m³ / 50 kg is a small item (LIGHT), above either a large one
// (HEAVY) — the heavier pick decides (websiteSizeTier.ts).
const sizeClass = (code: string): WeightClass => (code.endsWith("_LG") ? "HEAVY" : "LIGHT");

const VOLUME_BRACKETS: Bracket[] = Object.entries(VOLUME_BRACKET_MAX_M3)
  .sort(([, a], [, b]) => a - b)
  .map(([code, maxM3]) => ({
    code,
    labelEn: `Up to ${maxM3} m³`,
    labelNo: `Opptil ${String(maxM3).replace(".", ",")} m³`,
    weightClass: sizeClass(code),
  }));

const WEIGHT_BRACKETS: Bracket[] = [
  { code: "OF_WT_SM", labelEn: "Up to 50 kg", labelNo: "Opptil 50 kg", weightClass: "LIGHT" },
  { code: "OF_WT_LG", labelEn: "Over 50 kg", labelNo: "Over 50 kg", weightClass: "HEAVY" },
];

function toOption(bracket: Bracket, category: string): FurnitureOptionSeed {
  return {
    code: bracket.code,
    category: category as FurnitureOptionSeed["category"],
    labelEn: bracket.labelEn,
    labelNo: bracket.labelNo,
    exclusiveGroup: category,
    customerPrice: 0,
    subcontractorPrice: 0,
    staffPriced: true,
    weightClass: bracket.weightClass,
  };
}

// A large item's delivery prices, one per delivery type — a copy of the
// side-by-side fridge's at seed time; staff edit them in Edit prices
// (staffPriced: a reseed keeps theirs). A small item keeps the product's own
// delivery prices (the oven's).
const sideBySideDelivery = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_SIDE_BY_SIDE_FRIDGE")!.deliveryTypes;

const LARGE_DELIVERY_OPTIONS: FurnitureOptionSeed[] = [
  {
    code: LARGE_DELIVERY_OPTION_CODES.FIRST_STEP!,
    labelEn: "Large item — delivery to first obstacle",
    labelNo: "Stor vare — levering til første hindring",
    customerPrice: sideBySideDelivery.firstStep.customerPrice,
    subcontractorPrice: sideBySideDelivery.firstStep.subcontractorPrice,
  },
  {
    code: LARGE_DELIVERY_OPTION_CODES.INDOOR!,
    labelEn: "Large item — delivery with carry-in",
    labelNo: "Stor vare — levering med innbæring",
    customerPrice: sideBySideDelivery.indoor.customerPrice,
    subcontractorPrice: sideBySideDelivery.indoor.subcontractorPrice,
  },
].map((option) => ({ ...option, category: SIZE_LARGE_DELIVERY_CATEGORY, staffPriced: true }));

export const OTHER_FURNITURE_PRODUCT_CODE = "FN_OTHER_FURNITURE";

export const OTHER_FURNITURE_SIZE_OPTIONS: FurnitureOptionSeed[] = [
  ...VOLUME_BRACKETS.map((b) => toOption(b, SIZE_VOLUME_CATEGORY)),
  ...WEIGHT_BRACKETS.map((b) => toOption(b, SIZE_WEIGHT_CATEGORY)),
  ...LARGE_DELIVERY_OPTIONS,
];
