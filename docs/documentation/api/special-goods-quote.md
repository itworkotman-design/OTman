# `app/api/site/special-goods-quote/route.ts`

## Purpose
Final submission for the "Andre varer"/"Spesialvarer" quote-request flow —
items too unusual/oversized to auto-price. Same shape as
`moving-request/route.ts`: creates an unpriced `Order` (`isWebsiteOrder:
true`, `priceExVat: 0`, `status: "processing"`), no pricing engine involved,
staff quote manually via the same approve/reject/Stripe pipeline every other
website order uses. Photos are optional — an empty/absent `quoteToken` is
valid (nothing to link); only a present-but-malformed token is rejected.

Includes a honeypot field (`_hp`) — a filled value returns a fake `{ ok:
true }` without doing anything, same pattern as
`app/api/public/vehicle-booking/route.ts`.

## Functions
- `POST` — validates the body, honeypot + rate-limit checks, creates the
  `Order`, links any `PendingQuoteAttachment` rows for the submitted
  `quoteToken` via `linkPendingQuoteAttachments`, logs the `OrderEvent` +
  staff `OrderNotification` (mentioning the photo count if any).
