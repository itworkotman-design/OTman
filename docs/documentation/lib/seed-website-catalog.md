# `lib/content/seedWebsiteCatalog.ts`

## Purpose
Shared, idempotent seeding routine for a website catalog: upserts the PriceList (order-level fees in its description), each Product (delivery types JSON, rounded to 5 kr) and each ProductOption with its PriceListItem. Used by white goods and furniture.

## Functions
### `seedWebsiteCatalog({ priceListCode, priceListName, products })`
Returns `{ priceListId, productsUpserted, optionsUpserted }`.
