# Price Lists

## Source

- `lib/products/priceLists.ts`

## Responsibility

Loads price lists together with their item/product metadata for the edit-prices flow.

## Functions

| Function | Description |
| --- | --- |
| `isMissingPriceListDescriptionColumnError` | Detects older databases that do not yet have the optional price-list description column. |
| `findPriceListById` | Loads a price list and its items from Prisma, including the product-level config flags needed by the edit-prices UI. |
| `getPriceListById` | Wraps `findPriceListById` with fallback behavior for older schemas. Product rows now include `allowModelNumber`. |
