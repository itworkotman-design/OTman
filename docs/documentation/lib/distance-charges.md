# Distance Charges

## Source

- `lib/booking/pricing/distanceCharges.ts`
- used by `buildCalculatorBreakdownsWithOrderExtras` in `lib/booking/pricing/orderCalculatorExtras.ts`

## Responsibility

Decides how many kilometers are billed on the `KM_FROM_21` (21–100 km) and `KM_OVER_100` (over 100 km) order-extra lines. Up to 20 km is always free.

- **New rule** (orders created on/after `FULL_DISTANCE_KM_PRICING_FROM`, and any unsaved order): once over 20 km, every started km of the whole distance is billed — 30 km → 30, 130 km → 130.
- **Old rule** (orders created before the cutoff): only started km above 20 are billed — 30 km → 10, 130 km → 110.

Because the dashboard re-prices existing orders live from `drivingDistance`, `BookingEditor` and `ReadOnlyOrderModal` pass `useFullDistanceKmPricing: usesFullDistanceKmPricing(order.createdAt)` (the order's `createdAt` comes from `GET /api/orders/[orderId]`). Server-side new-order paths (site transport request, `computeFullOrderTotal` for recurring orders) use the default (`true`). The subcontractor km line uses the same quantity.

## Functions

| Function | Description |
| --- | --- |
| `getFullChargeableKilometers` | New rule: `0` at or below 20 km, otherwise the whole distance rounded up to the started km. |
| `getStartedChargeableKilometers` | Old rule: started km above 20 km. |
| `usesFullDistanceKmPricing` | `true` for orders with no/invalid `createdAt` or created at/after `FULL_DISTANCE_KM_PRICING_FROM`. |
