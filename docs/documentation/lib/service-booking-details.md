# `lib/orders/serviceBookingDetails.ts`

## Purpose
What a homepage service request answered, kept on the order (`Order.websiteBookingDetails`, `websiteOrderKind` =
`SERVICE_ORDER_KIND` = `"SERVICE"`) so `WebsiteOrderModal` can show and edit it: one or more services, each with what needs
doing. The address, date and time window live on the order's own columns. Tested.

## Types
- `ServiceRequestItem` — `{ serviceCode, customService, jobDescription }` (a `SERVICE_REQUEST_OPTIONS` code; `customService`
  names the custom one).
- `ServiceBookingDetails` — `{ version: 2, customerType, services: ServiceRequestItem[] }`.

## Functions
- `buildServiceBookingDetails({ customerType, services })` — the stored record (the custom name only for the custom service).
- `parseServiceRequestItems(raw)` — the services a request or an edit sends: at least one, each listed service once, each
  with a job description (required, no disallowed characters); returns the items with their English `labelEn`, or errors
  keyed `services` / `services.<index>.<field>`.
- `parseServiceBookingDetails(value)` — the stored record re-validated, or `null` (e.g. a request sent before this was
  stored — it then opens in the regular `OrderModal`). A single-service request stored before services were a list
  (`version: 1`) reads as a list of one.
