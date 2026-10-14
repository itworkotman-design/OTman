# `lib/orders/movingCurrentPrices.ts`

## Purpose
A booked move priced at today's moving catalog with its own stored answers and distance — what "Use new price" changes it to.
Covered by the website-details and moving-details route tests.

## Functions
- `movingCurrentPriceRows(catalog, order)` — its lines at today's prices (`movingOrderItemRows`), or `null` when its answers
  can't be priced.
- `movingPricesOutdated(catalog, order)` — whether any line (customer or partner) is priced differently today
  (`movingPriceChanges`).
