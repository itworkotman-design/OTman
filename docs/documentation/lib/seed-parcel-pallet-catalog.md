# `lib/content/seedParcelPalletCatalog.ts`

## Purpose
Seeds the website parcel/pallet catalog on its own `WEBSITE_PARCEL_PALLET`
price list. Run standalone via `npm run seed:parcel-pallet-catalog` — not
part of `prisma/seed.ts`'s `main()`. Thin wrapper around
`seedWebsiteCatalog()` (same as furniture/white goods) but passes
`preservePricesOnReseed: true`, since this catalog's prices are staff-entered
placeholders rather than sourced from a spreadsheet.

## Functions
- `seedParcelPalletCatalog()` — `{ priceListId, productsUpserted, optionsUpserted }`.
