import { WHITE_GOODS_ORDER_LEVEL_EXTRAS } from "@/lib/content/whiteGoodsElectronics";
import type { WeightClass } from "@/lib/products/weightClass";

// Website weight class prices (the size-category table, decided 2026-11-02),
// NOK ex. VAT as given — seeding cleans the customer price like every other
// website price (websiteSeedCustomerPrice: 26 → 32 …). Seeded onto each
// website price list's settings (PriceListSettings.weightClassPricing) and
// editable there afterwards. See lib/booking/pricing/websiteWeightClass.ts.

// Per chargeable floor with no lift — one rate per order, the heaviest item's.
export const WEIGHT_CLASS_FLOOR_SURCHARGE: Record<WeightClass, number> = { LIGHT: 26, MEDIUM: 49, HEAVY: 76 };

// Return for recycling, per item.
export const WEIGHT_CLASS_RETURN_PRICE: Record<WeightClass, number> = { LIGHT: 75, MEDIUM: 150, HEAVY: 300 };

// A list's own prices for some classes, over the table above: a customer
// price (partner at the usual share), or both prices.
export type WeightClassPriceOverride = number | { customerPrice: number; subcontractorPrice: number };
export type WeightClassPriceOverrides = {
  floorSurcharge?: Partial<Record<WeightClass, WeightClassPriceOverride>>;
  returnPrice?: Partial<Record<WeightClass, WeightClassPriceOverride>>;
};

// White goods keep what they cost before weight classes (decided
// 2026-11-02): light (all but one) 75 floor / 260 return; heavy is only the
// side-by-side fridge, whose return keeps its own larger price (464.4 / 258
// in the source). Furniture keeps the table.
export const WHITE_GOODS_WEIGHT_CLASS_PRICES: WeightClassPriceOverrides = {
  floorSurcharge: { LIGHT: 75 },
  returnPrice: { LIGHT: 260, HEAVY: { customerPrice: 464.4, subcontractorPrice: 258 } },
};

// The table has no partner prices: the partner gets the same share of the
// customer price as before weight classes (the flat floor surcharge and the
// standard return option).
export const FLOOR_SURCHARGE_PARTNER_SHARE =
  WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.subcontractorPrice / WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.customerPrice;
export const RETURN_PARTNER_SHARE = 154.8 / 258;
