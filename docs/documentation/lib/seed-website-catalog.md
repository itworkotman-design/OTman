# `lib/content/seedWebsiteCatalog.ts`

## Purpose
Shared, idempotent seeding routine for a website catalog: upserts the PriceList (order-level fees in its description), each Product (delivery types JSON, rounded to 5 kr) and each ProductOption with its PriceListItem. Used by white goods, furniture, and parcel/pallet.

## Functions
### `seedWebsiteCatalog({ priceListCode, priceListName, products, preservePricesOnReseed? })`
Returns `{ priceListId, productsUpserted, optionsUpserted }`.

`preservePricesOnReseed` (default `false`, white goods/furniture's existing behavior — their prices come from a spreadsheet and are meant to refresh on every reseed) — when `true`, a reseed never resets prices a caller doesn't own: both `PriceListItem.customerPriceCents`/`subcontractorPriceCents` (options) **and** `Product.deliveryTypes` (the only price for a delivery-only product with no options at all, e.g. parcel/pallet's "Bag") are excluded from the `update` branch, only ever set on `create`. Used by `seedParcelPalletCatalog.ts`, whose prices are staff-entered placeholders, not sourced from a spreadsheet.
