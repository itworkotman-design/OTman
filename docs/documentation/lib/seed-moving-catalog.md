# `lib/content/seedMovingCatalog.ts`

## Purpose
Seeds the `WEBSITE_MOVING` price list: one bare `Product`
(`allowDeliveryTypes`/`allowInstallOptions`/`allowExtraServices`/
`allowReturnOptions`/`allowQuantity` all `false` — just flat per-option
prices, no delivery-type or install-option machinery) with one `ProductOption`
per size bracket. Run standalone via `npm run seed:moving-catalog` — not part
of `prisma/seed.ts`'s `main()`.

**Differs from `seedWebsiteCatalog.ts` (white goods/furniture) in one
important way**: `PriceListItem` prices are only ever set on first `create`,
never touched on `update`. Those catalogs' prices come from a spreadsheet and
are meant to be refreshed by reseeding; Moving's prices are meant to be
entered and maintained by staff via `/dashboard/booking/editPrices` — a
reseed (e.g. a fresh dev DB setup) must never silently reset them back to 0.

## Functions
- `seedMovingCatalog()` — `{ priceListId, productId, optionsUpserted }`.
