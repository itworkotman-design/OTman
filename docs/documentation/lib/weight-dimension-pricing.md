# `lib/booking/pricing/weightDimensionPricing.ts`

## Purpose
Generic weight/dimension pricing primitive, built ahead of any real consumer
per an explicit request — see `docs/homepage-ordering-roadmap.md` §5. A
`ProductOption` whose `pricingMode` is `PER_KG`/`PER_M3` (see `PricingMode`'s
own schema comment) prices as a base/minimum charge
(`PriceListItem.customerPriceCents`, the same field every `FIXED`-mode
option already uses) plus a rate per unit
(`PriceListItem.customerRatePerUnitCents`) times a submitted quantity,
optionally capped (`PriceListItem.customerMaxChargeCents`).

**Schema + this calculation engine only, deliberately not wired further
yet.** Not touched: the shared per-card pricing loop
(`lib/booking/pricing/fromProductCards.ts`, used by both the internal
dashboard and every website booking flow) or any customer-facing quantity
input UI. That file is business-critical and shared by every existing order
type — modifying its branching logic with no real weight/dimension-priced
product yet to validate against would be pure regression risk for zero
current benefit. The catalog fetch layer (`getBookingCatalog.ts`,
`/api/booking/catalog/route.ts`) *does* already expose the new fields
(`CatalogOption.pricingMode`/`customerRatePerUnitCents`/etc., all optional),
so a future product just needs: (1) real values in `PriceListItem`, (2) a
branch in `fromProductCards.ts` calling this engine when `pricingMode` isn't
`FIXED`, and (3) a UI to collect the quantity — this file is step 0 of that,
already done and tested.

## Functions
- `calculateWeightDimensionPriceCents({ baseCents, ratePerUnitCents, maxChargeCents? }, quantity)`
  — the arithmetic. Throws for a non-positive/non-finite `quantity` (never a
  silent 0 or negative charge) — validating that a submitted quantity is
  sensible is the caller's job, not this function's.
- `isWeightDimensionPricingMode(mode)` — type guard for `"PER_KG" | "PER_M3"`.
- `weightDimensionUnitLabel(mode)` — `"kg"` or `"m³"`.
