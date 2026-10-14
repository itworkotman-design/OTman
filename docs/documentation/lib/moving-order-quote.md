# `lib/orders/movingOrderQuote.ts`

## Purpose
One move priced from the moving catalog — shared by the booking route (`app/api/site/moving-request`), the admin edit
(`app/api/orders/[orderId]/moving-details`) and "My order" (`app/api/customer/orders/[orderNumber]`), so an edited
move is priced exactly like a booked one. Tested.

## Functions
- `priceMovingOrder(catalog, { origin, destination, serviceCodes, drivingDistance })` — origin size + services + no-lift
  floor surcharge + carrying distance + km (`movingDistanceLines`); `pricing` (`movingOrderPricing`, its snapshot carrying
  every line), staff lines (`originLine`/`destinationLine`) and `summary`. Unknown size/service → `{ ok: false, errors }`.
- `movingOrderItemRows(lines)` — the stored `Order.items`, one per priced line (unit price × quantity).
