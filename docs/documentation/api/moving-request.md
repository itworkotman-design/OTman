# `app/api/site/moving-request/route.ts`

## Purpose
Public submission endpoint for the homepage "Flytting" (Moving) tile's
priced booking flow (`MovingRequestFlow.tsx`). Priced by size bracket
(`WEBSITE_MOVING` price list — see `lib/content/movingCatalog.ts` and
`lib/content/getMovingCatalog.ts`), not by a full pricing engine like
white-goods/furniture — the client sends a `sizeOptionCode`, which this route
re-resolves to a real price server-side via `getMovingCatalog()`/
`findMovingSizeOption()` rather than trusting whatever price the client
displayed. Creates an `Order` (`isWebsiteOrder: true`, real `priceExVat`/
`priceSubcontractor`, `status: "processing"`) + one `OrderItem` — same `Order`
model, same dashboard review UI, same approve/reject/Stripe pipeline as every
other website order; no new status value or schema change. A staff member
still reviews and approves before the customer gets a payment link, same gate
as every other website order. See `docs/homepage-ordering-roadmap.md` §6 for
the pricing architecture decision and progress log.

Independent in-memory rate limiter (20/day, 1/minute) from the other public
order routes, by design — see `lib/orders/websiteOrderValidation.ts` for the
shared field validators it reuses. Diverges from `white-goods-order` in one
respect: email is required here (that route treats it as optional), since
this flow's only possible outcome is staff emailing the customer a payment
link.

Returns `500` (`ORDER_CREATION_FAILED`) if the `WEBSITE_MOVING` price list
hasn't been seeded yet (`npm run seed:moving-catalog`), and `422` with a
`sizeOptionCode` error if the submitted code doesn't match a real, active
bracket.

## Functions
- `POST` — validates the body, rate-limits, resolves the selected size
  bracket's real price, then creates the `Order` + `OrderItem` +
  `OrderEvent` + staff `OrderNotification`.
