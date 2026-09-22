# `app/api/site/moving-request/catalog/route.ts`

## Purpose
Public, unauthenticated GET endpoint returning the Moving flow's size-bracket
options and their current prices, for `MovingRequestFlow.tsx`'s live price
display. Deliberately its own small route rather than the generic
`/api/booking/catalog` (env-gated to exactly one public price list) or
`lib/booking/catalog/getBookingCatalog` (returns every active product in the
DB, unscoped — see the "Catalog not price-list-scoped" note in
`docs/homepage-ordering-roadmap.md`). Thin wrapper around
`getMovingCatalog()`, shared with the submission route's server-side price
re-resolution.

## Functions
- `GET` — `{ ok, priceListId, options }`, or `404 NOT_SEEDED` if
  `npm run seed:moving-catalog` hasn't been run yet.
