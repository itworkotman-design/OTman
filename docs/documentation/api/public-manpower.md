# `app/api/public/manpower/route.ts`

## Purpose
Backs the live `/tjenester` (Services) page's form — trade/staffing
outsourcing requests (electrician, carpenter, plumber, gardener, cleaner,
IT, custom; see `TjenesterContent.ts`'s `jobTypeOptions`, the already-live,
already-approved content this route builds on — no new business-content
decision was needed to build this). Used to only send a plain email to
`bestilling@otman.no`; now creates an unpriced `Order` (`isWebsiteOrder:
true`, `priceExVat: 0`, `status: "processing"`) instead, same shape as
Moving/special-goods — lands in the same dashboard review / staff-quote /
Stripe pipeline every other website order uses. See
`docs/homepage-ordering-roadmap.md` §6.

The live form's validation contract (field names, error behavior, rate
limits) is deliberately unchanged from before — only what happens *after*
validation passes is new, so `/tjenester`'s UI needed no changes at all.

**One accepted tradeoff**: the live form only ever collects one freeform
`contact` field (not split phone/email like every newer flow). This route
classifies it — email-shaped → `Order.email`, otherwise → `Order.phone` —
rather than requiring a UI change to already-live copy. The raw value is
always also kept in `Order.description` regardless of classification, so
nothing is lost even when the guess is wrong. Consequence: `Order.email` can
end up `null`, meaning no automatic payment-link/lifecycle email until staff
add one manually — an accepted, documented tradeoff, not an oversight.

## Functions
- `POST` — unchanged validation, then `createServiceRequestOrder` (Order +
  `OrderEvent` + staff `OrderNotification`, mirroring `moving-request`'s
  shape).
- `classifyContact(contact)` — the email/phone heuristic above.
