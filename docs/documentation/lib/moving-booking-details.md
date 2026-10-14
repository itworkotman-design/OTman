# `lib/orders/movingBookingDetails.ts`

## Purpose
What the customer answered for a homepage move, kept on the order (`Order.websiteBookingDetails`,
`websiteOrderKind = MOVING_ORDER_KIND` = `"MOVING"`) so the admin `WebsiteOrderModal` and "My order" can show and edit it.
Addresses, date, time window and distance live on the order's own columns. Tested.

## Functions
- `buildMovingBookingDetails({ customerType, origin, destination, serviceCodes })` — version 1; both ends as the flow's draft codes.
- `parseMovingBookingDetails(value)` — re-validates both ends with `parseMovingProperty`; `null` for anything else (e.g. a move booked before this was stored). An unknown customer type becomes `null`.
