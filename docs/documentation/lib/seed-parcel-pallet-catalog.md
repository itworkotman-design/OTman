# `lib/content/seedParcelPalletCatalog.ts`

## Purpose
Seeds the website parcel/pallet catalog on its own `WEBSITE_PARCEL_PALLET`
price list. Run standalone via `npm run seed:parcel-pallet-catalog` — not
part of `prisma/seed.ts`'s `main()`. Thin wrapper around
`seedWebsiteCatalog()` (same as furniture/white goods) but passes
`preservePricesOnReseed: true`. A reseed never resets a price staff entered in Edit prices, but fills a price still at the old 0 kr placeholder with the seed's price, and switches off carry-in for pallets.

## Functions
- `seedParcelPalletCatalog()` — `{ priceListId, productsUpserted, optionsUpserted }`.
