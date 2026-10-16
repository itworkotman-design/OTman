# `lib/orders/serviceOrderEdit.ts`

## Purpose
Changing a homepage service request — shared by the admin edit (`service-details`) and the customer's "My order"
(`app/api/customer/orders/[orderNumber]`): the request as an editable whole (the address, and each service with its job and
staff's quote), how a customer's change is classified, and what a save writes. Tested.

## Types
- `ServiceQuote` — `{ customer, partner }`, kroner ex. VAT, `null` = not priced.
- `ServiceEditItem` / `ServiceEdit` — `{ address, services: (ServiceRequestItem & { quote })[] }`.
- `ServiceAnswers` — the same without the quotes (what "My order" edits).

## Functions
- `serviceEditFromOrder(order)` — `ServiceEdit` from the booking details, `deliveryAddress` and each service's quote line
  (`QUOTE:<serviceCode>`; a pre-list request's single `QUOTE` line too); `null` without service answers.
- `serviceAnswersOf(edit)` — the request without the quotes.
- `classifyServiceEdit(before, after)` — a customer's change as policy kinds: `addresses`, `reconfigure` (a service added,
  removed or renamed), `notes` (a job description).
- `parseServiceEdit(raw)` — validates the address, the services (`parseServiceRequestItems`) and each quote (`null` or
  0–10 000 000 kr); returns the edit and each service's English label (`labels`).
- `serviceQuoteItemRows(services, labels)` — one `SERVICE_QUOTE` line per priced service (an empty side is 0).
- `serviceOrderDescription({ customerType, services })` / `serviceOrderSummary(labels)` — the description
  (`Customer type: …`, then `Service: <label>\n<job>` per service) and `productsSummary` (`Service request (A + B)`) a
  request stores (shared with `app/api/site/service-request`).
- `serviceOrderSaveData({ parsed, customerType, adjustments, handlingRows })` — the order fields and lines (quotes +
  express/deviation) a save writes, priced with `serviceOrderAdjustedPricing`.
