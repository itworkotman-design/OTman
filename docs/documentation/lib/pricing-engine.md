# Pricing Engine

## Source

- `lib/booking/pricing/engine.ts`

## Responsibility

Calculates booking breakdown totals from product breakdowns, price lookup data, and admin adjustment inputs. The engine now preserves negative customer and subcontractor totals when discounts or minus adjustments exceed the base subtotal.

## Functions

| Function | Description |
| --- | --- |
| `parseNOK` | Parses a free-form price input string such as `1 780`, `1780`, or `-200` into a numeric value. |
| `roundPriceRule` | Rounds pricing values to two decimals using the shared booking-price rule. |
| `calculateBookingPricing` | Builds the calculated breakdown rows, subtotal, VAT, total including VAT, and subcontractor total from product breakdowns plus admin adjustments, while preserving negative totals instead of clamping them to zero. |
