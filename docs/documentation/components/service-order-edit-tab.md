# `app/_components/Dahsboard/booking/websiteOrders/ServiceOrderEditTab.tsx`

## Purpose
The admin's "Edit order" tab for a homepage service request in `WebsiteOrderModal`, in the same dashboard style as
`MovingOrderEditTab` (`EditTabParts.tsx`).

## Behaviour
- **Services:** the services modal's tiles (`SERVICE_REQUEST_OPTIONS` with `ServiceIcon`) toggle services on and off; each
  picked service gets its own card (with Remove): the custom service's name, what needs doing, and its quote — customer
  price and partner price, ex. VAT, its own priced line. Empty = not priced yet.
- **Where:** the address (`AddressAutocompleteInput`).
- **Date and time** (`TimeWindowChoice`) and **Customer** (Private / Business, name, phone, email, comments).
- **Calculator:** the Overview's `WebsiteOrderCalculator` beside them (`externalPricing`; no "Use new price"), with the
  payment preview under it.
- Every change is priced by `PUT /api/orders/[orderId]/service-details` (`dryRun`, debounced) and saved at that price. What's
  missing shows in red and keeps Save disabled.

## `serviceEditBody.ts`
- `serviceEditBody(initial, current)` — the save body, only what changed (`edit`, `customer`, `customerType`,
  `preferredDate` + `timeWindow`). Tested.
- `serviceEditBlockers(draft)` — fields keeping Save disabled: no service at all, or per service (`services.<i>.…`) a custom service without its name, no job
  description, no address, a negative price, an incomplete time window. Tested.
