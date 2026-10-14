# `lib/content/seedMovingCatalog.ts`

## Purpose
Seeds the `WEBSITE_MOVING` price list: one bare `Product`
(`allowDeliveryTypes`/`allowInstallOptions`/`allowExtraServices`/
`allowReturnOptions`/`allowQuantity` all `false` — just flat per-option
prices, no delivery-type or install-option machinery) with one `ProductOption`
per size bracket, and a second bare product (`MOVING_ADDITIONAL_SERVICES`,
option `category: "service"`) with one option per additional service. Run standalone via `npm run seed:moving-catalog` — not part
of `prisma/seed.ts`'s `main()`.

**Differs from `seedWebsiteCatalog.ts` (white goods/furniture) in one
important way**: `PriceListItem` prices are only ever set on first `create`,
never touched on `update`. Those catalogs' prices come from a spreadsheet and
are meant to be refreshed by reseeding; Moving's prices are meant to be
entered and maintained by staff via `/dashboard/booking/editPrices` — a
reseed (e.g. a fresh dev DB setup) must never silently reset them back to 0.

## Functions
- Options no longer in the code are set `isActive: false` (not deleted) on reseed, and listed ones back to `isActive: true` — so dropping one from `MOVING_SIZE_OPTIONS`/`MOVING_SERVICE_OPTIONS` and reseeding takes it off the site.
- Also seeds the per-floor surcharge product (`MOVING_FLOOR_SURCHARGE`, one option) and the carrying-distance product (`MOVING_CARRY_SURCHARGE`, two options).
- After each price row's upsert, fills in the starting price where `customerPriceCents` is still 0 (the old placeholder) — a staff-set price is never overwritten.
- `seedMovingCatalog()` — `{ priceListId, productId, optionsUpserted, servicesProductId, servicesUpserted }`.
