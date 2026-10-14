# `lib/orders/movingOrderEdit.ts`

## Purpose
Changing a booked move — shared by the admin edit and the customer's "My order". Tested.

## Functions
- `movingEditFromOrder(order)` — the move as a `MovingEdit` (addresses from the columns, the rest from `websiteBookingDetails`), or `null`.
- `parseMovingEdit(raw)` — validates addresses, both ends (`parseMovingProperty`) and service codes.
- `classifyMovingEdit(before, after)` — a delivery order's change kinds (`customerOrderEditPolicy.ts`): moved address →
  `addresses`, either end changed or a service removed → `reconfigure`, services only added → `addOns`. So the same 24h
  policy applies: within 24h of the job a customer may only add services.
- `movingOrderSaveData({ quote, parsed, drivingDistance, notes, customerType })` — the order fields and lines a save writes.
