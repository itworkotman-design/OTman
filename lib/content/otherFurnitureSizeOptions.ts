import type { FurnitureOptionSeed } from "@/lib/content/furnitureCatalog";
import { SIZE_VOLUME_CATEGORY, SIZE_WEIGHT_CATEGORY } from "@/lib/booking/pricing/sizeBrackets";
import { VOLUME_BRACKET_MAX_M3 } from "@/lib/booking/pricing/sizeDimensions";

// Volume (m³) and weight (kg) brackets for website furniture "Other furniture"
// (FN_OTHER_FURNITURE) — the catch-all product that is priced by how big and
// heavy the item is. The customer picks one of each; the price added on top of
// the flat delivery price is the higher of the two (lib/booking/pricing/
// sizeBrackets.ts). Kept here rather than in furnitureCatalogData.ts because
// that file is GENERATED from the source workbook and would lose them on
// regeneration; furnitureCatalog.ts merges these in.
//
// The customer does not pick the volume bracket: they choose width, height and
// length and the volume (m³) is calculated, then placed in a bracket
// (sizeDimensions.ts). So the volume brackets here are GENERATED from
// VOLUME_BRACKET_MAX_M3 — the one table that decides where each bracket ends —
// and can't drift from it. The weight brackets are still picked directly.
//
// The bracket BOUNDARIES are placeholders — business content nobody has supplied
// yet — and every price is 0 kr on purpose: staff set the real prices per price
// list in /dashboard/booking/editPrices before launch (moving a boundary is a
// code change in VOLUME_BRACKET_MAX_M3 / the weight list below).
// `staffPriced` makes a reseed leave staff-entered prices alone. Anything larger
// than the top bracket needs a manual quote (no bracket = not bookable online).

type Bracket = { code: string; value: string; valueNo: string };

const VOLUME_BRACKETS: Bracket[] = Object.entries(VOLUME_BRACKET_MAX_M3)
  .sort(([, a], [, b]) => a - b)
  .map(([code, maxM3]) => ({ code, value: String(maxM3), valueNo: String(maxM3).replace(".", ",") }));

const WEIGHT_BRACKETS: Bracket[] = [
  { code: "OF_WT_1", value: "25", valueNo: "25" },
  { code: "OF_WT_2", value: "50", valueNo: "50" },
  { code: "OF_WT_3", value: "100", valueNo: "100" },
  { code: "OF_WT_4", value: "200", valueNo: "200" },
  { code: "OF_WT_5", value: "400", valueNo: "400" },
];

function toOption(bracket: Bracket, category: string, unit: string): FurnitureOptionSeed {
  return {
    code: bracket.code,
    category: category as FurnitureOptionSeed["category"],
    labelEn: `Up to ${bracket.value} ${unit}`,
    labelNo: `Opptil ${bracket.valueNo} ${unit}`,
    exclusiveGroup: category,
    customerPrice: 0,
    subcontractorPrice: 0,
    staffPriced: true,
  };
}

export const OTHER_FURNITURE_PRODUCT_CODE = "FN_OTHER_FURNITURE";

export const OTHER_FURNITURE_SIZE_OPTIONS: FurnitureOptionSeed[] = [
  ...VOLUME_BRACKETS.map((b) => toOption(b, SIZE_VOLUME_CATEGORY, "m³")),
  ...WEIGHT_BRACKETS.map((b) => toOption(b, SIZE_WEIGHT_CATEGORY, "kg")),
];
