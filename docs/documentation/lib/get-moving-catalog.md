# `lib/content/getMovingCatalog.ts`

## Purpose
Server-side query for the Moving flow's size-bracket options + live prices
(`WEBSITE_MOVING` price list). Shared by
`app/api/site/moving-request/catalog/route.ts` (the public price the
customer sees while picking a size) and `app/api/site/moving-request/route.ts`
(re-resolving that same price server-side on submit, rather than trusting a
client-sent value) — one query, one source of truth for both.

## Functions
- `getMovingCatalog()` — `{ priceListId, options }` or `null` if the
  `WEBSITE_MOVING` price list hasn't been seeded yet
  (`npm run seed:moving-catalog`). Options are active-only, sorted by
  `sortOrder`.
- `findMovingSizeOption(options, code)` — looks up one option by code from
  that list; `null` for an unknown/missing code.
