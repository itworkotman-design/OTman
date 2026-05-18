# Frozen Order Pricing

## Source

- `lib/booking/pricing/frozenOrderPricing.ts`

## Responsibility

Keeps existing orders price-frozen while still comparing their stored snapshot totals against current catalog totals. Imported or custom lines that are not represented in normal product-card pricing are preserved as the delta between the stored order total and the saved snapshot calculation.

## Functions

| Function | Description |
| --- | --- |
| `calculateCurrentTotalsWithFrozenExternalLines` | Adds the frozen stored-vs-snapshot delta to the current catalog calculation for customer and subcontractor totals. |
| `frozenOrderTotalsDiffer` | Compares two frozen-order total sets using the calculator's two-decimal rounding rule. |
