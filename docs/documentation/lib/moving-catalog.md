# `lib/content/movingCatalog.ts`

## Purpose
Static data for the Moving flow's size-bracket pricing (`WEBSITE_MOVING`
price list, `MOVING_BY_SIZE` product). Deliberately its own small shape —
`MovingSizeOptionSeed` — rather than reusing `WhiteGoodsProductSeed`/
`FurnitureProductSeed`, which are fitted to a delivery-type + install-option +
extras product structure that a flat "pick one bracket" price doesn't need.
Prices are seeded at 0 — a placeholder for staff to set via
`/dashboard/booking/editPrices`, not real figures (see
`docs/homepage-ordering-roadmap.md` §6 progress log for why).

## Exports
- `MOVING_PRICE_LIST_CODE` — re-exported from `websitePriceListCodes.ts`.
- `MOVING_PRODUCT_CODE` — `"MOVING_BY_SIZE"`.
- `MOVING_SIZE_OPTIONS: MovingSizeOptionSeed[]` — the 5 size brackets.
- `MOVING_SERVICES_PRODUCT_CODE` — `"MOVING_ADDITIONAL_SERVICES"`, a second
  product on the same price list for the optional extras.
- `MOVING_SERVICE_OPTIONS: MovingServiceOptionSeed[]` — Nedpakking
  (`SERVICE_NEDPAKKING`) and Flyttevask (`SERVICE_FLYTTEVASK`) — Mellomlagring
  is left out for now; flat price each (seeded at 0, set by staff), plus
  `blurbEn`/`blurbNo` tile copy used by `MovingRequestFlow` (not stored in the DB).
