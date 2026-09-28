// Generic weight/dimension pricing primitive — a ProductOption whose
// pricingMode is PER_KG/PER_M3 (see PricingMode's own schema comment) prices
// as a base/minimum charge plus a rate per unit, times a customer-submitted
// quantity, optionally capped. Schema + this calculation engine exist now;
// no product uses this yet, so it isn't wired into the shared per-card
// pricing loop (lib/booking/pricing/fromProductCards.ts) or any
// customer-facing UI — see docs/homepage-ordering-roadmap.md §5 for the
// integration point once a real product needs it, to avoid touching that
// shared, business-critical pricing code without a real case to validate
// against.

export const WEIGHT_DIMENSION_PRICING_MODES = ["PER_KG", "PER_M3"] as const;
export type WeightDimensionPricingMode = (typeof WEIGHT_DIMENSION_PRICING_MODES)[number];

export function isWeightDimensionPricingMode(mode: string): mode is WeightDimensionPricingMode {
  return (WEIGHT_DIMENSION_PRICING_MODES as readonly string[]).includes(mode);
}

export function weightDimensionUnitLabel(mode: WeightDimensionPricingMode): string {
  return mode === "PER_KG" ? "kg" : "m³";
}

export type WeightDimensionRate = {
  // PriceListItem.customerPriceCents (or subcontractor) — doubles as the
  // base/minimum charge, same field every FIXED-mode option already uses.
  baseCents: number;
  // PriceListItem.customerRatePerUnitCents (or subcontractor).
  ratePerUnitCents: number;
  // PriceListItem.customerMaxChargeCents (or subcontractor) — optional
  // ceiling. A non-positive value is treated as unset, never as "cap at 0".
  maxChargeCents?: number | null;
};

// Throws for an invalid quantity rather than silently producing a 0 or
// negative charge — a caller passing e.g. a customer-submitted weight
// should validate it's a sensible positive number before calling this at
// all; this function isn't the place to decide what "sensible" means for
// any given category, only to do the arithmetic once it's known valid.
export function calculateWeightDimensionPriceCents(rate: WeightDimensionRate, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`quantity must be a positive finite number, got ${quantity}`);
  }

  const raw = rate.baseCents + Math.round(rate.ratePerUnitCents * quantity);

  if (typeof rate.maxChargeCents === "number" && rate.maxChargeCents > 0) {
    return Math.min(raw, rate.maxChargeCents);
  }

  return raw;
}
