# Moving order pricing

## Source

- `lib/orders/movingOrderPricing.ts`

## Responsibility

The price of a homepage moving request (`POST /api/site/moving-request`): the size bracket plus any additional services (Nedpakking/Flyttevask), each a flat line on the moving price list. Prices are ex. VAT, like every website price. The order stores it as `priceExVat`, with the partner price as `priceSubcontractor`. Its `pricingSnapshot` (built with `buildOrderPricingSnapshot`'s `customerTotalIncVat`) keeps what the customer pays: each line +25%, rounded to whole kroner per line (`websiteInclVat`). So the payment link (`getOrderChargeAmountIncVatNok`) charges exactly what `MovingRequestFlow` showed.

## Functions

- `movingOrderPricing(sizeOption, services = [])` — `{ priceExVat, priceSubcontractor, pricingSnapshot }`.
- `movingFloorSurchargeLines(perFloor, ends)` — one line per end with chargeable floors (`quantity` = floors, prices = per floor × floors, so VAT rounds on the line); `[]` when `perFloor` is null. Passed into `movingOrderPricing` with the services.
- `movingCarrySurchargeLines(surcharges, ends)` — one line per end whose parking answer has a surcharge (quantity 1); a line missing from the price list charges nothing.
- `movingDistanceLines(rates, distanceKm)` — the driving-distance (km) charge, same rule as delivery (`getFullChargeableKilometers`, `lib/booking/pricing/distanceCharges.ts`): nothing up to 20 km, then every started km of the whole distance at the `kmFrom21` rate (21–100 km) or `kmOver100` (over 100 km). Unlike delivery the size price is kept at any distance. A 0 kr rate or no rates charges nothing.
- `movingCustomerTotals(lines)` — `{ totalExVat, totalIncVat }` (per-line VAT rounding); client-safe, used by `MovingRequestFlow` for the live total so it matches the charge.
