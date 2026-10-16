# `lib/orders/serviceBookingDetails.ts`

## Purpose
What a homepage service request answered, kept on the order (`Order.websiteBookingDetails`, `websiteOrderKind` =
`SERVICE_ORDER_KIND` = `"SERVICE"`) so `WebsiteOrderModal` can show and edit it. The address, date and time window live on the
order's own columns. Tested.

## Functions
- `buildServiceBookingDetails({ customerType, serviceCode, customService, jobDescription })` — the stored record (version 1;
  the custom name only for the custom service).
- `parseServiceBookingDetails(value)` — the stored record re-validated (`parseServiceChoice`), or `null` (e.g. a request sent
  before this was stored — it then opens in the regular `OrderModal`).
