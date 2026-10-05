# `lib/content/seedWebsiteCatalog.ts`

## Purpose
Shared, idempotent seeding routine for a website catalog: upserts the PriceList (order-level fees in its description), each Product (delivery types JSON, rounded to 5 kr) and each ProductOption with its PriceListItem. Used by white goods, furniture, and parcel/pallet.

## Functions
### `seedWebsiteCatalog({ priceListCode, priceListName, products, preservePricesOnReseed? })`
Returns `{ priceListId, productsUpserted, optionsUpserted }`.

Before upserting a product's options, an option still stored under its old long code (see `shortCatalogCode.ts`) is renamed in place to the short code. The upsert then updates that same row, so its id, prices and every order pointing at it stay, and no duplicate appears. The rename is skipped when the short code already exists.

`preservePricesOnReseed` (default `false`, white goods/furniture's existing behavior — their prices come from a spreadsheet and are meant to refresh on every reseed) — when `true`, a reseed never resets prices a caller doesn't own: both `PriceListItem.customerPriceCents`/`subcontractorPriceCents` (options) **and** `Product.deliveryTypes` (the only price for a delivery-only product with no options at all, e.g. parcel/pallet's "Bag") are kept on reseed. One exception: a price still at 0 kr (customer and partner both 0) is treated as an unfilled placeholder and gets the seed's price (`mergePreservedDeliveryTypes`; a `PriceListItem` read before its upsert). A delivery type the seed switches off is switched off. `staffPriced` options are never filled. Used by `seedParcelPalletCatalog.ts`, whose prices are staff-entered placeholders, not sourced from a spreadsheet.
