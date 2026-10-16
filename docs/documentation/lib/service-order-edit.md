# `lib/orders/serviceOrderEdit.ts`

## Purpose
Changing a homepage service request from the admin modal (`service-details`): the request as an editable whole and what a
save writes. Tested.

## Functions
- `serviceEditFromOrder(order)` — `ServiceEdit` from the booking details, `deliveryAddress` and the quote line (`null` prices
  before it's quoted); `null` without service answers.
- `parseServiceEdit(raw)` — validates the service, job, address (required, no disallowed characters) and the quote (each side
  `null` or 0–10 000 000 kr); returns the edit and the service's English label.
- `serviceQuoteItemRows(quote, labelEn)` — the quote as one `SERVICE_QUOTE` order line (none until a price is given; an empty
  side is 0).
- `serviceOrderDescription({ labelEn, customerType, jobDescription })` / `serviceOrderSummary(labelEn)` — the description and
  `productsSummary` a request stores (shared with `app/api/site/service-request`).
- `serviceOrderSaveData({ parsed, customerType, adjustments, handlingRows })` — the order fields and lines (quote + express/
  deviation) a save writes, priced with `serviceOrderAdjustedPricing`.
- `ServiceAnswers` / `serviceAnswersOf(edit)` — the request without the quote (what "My order" edits).
- `classifyServiceEdit(before, after)` — a customer's change as policy kinds: `addresses`, `reconfigure` (service), `notes` (job description).
