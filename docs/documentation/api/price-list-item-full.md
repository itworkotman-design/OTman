# Price List Item Full API

## Source

- `app/api/products/pricelists/items/[itemId]/full/route.ts`

## Responsibility

Updates a full price-list item record together with its related product and product-option metadata.

## Functions

| Function | Description |
| --- | --- |
| `parseNokToCents` | Validates and converts a NOK value into stored cents. |
| `centsToNokString` | Converts stored cents into whole-number NOK strings for API responses. |
| `parseOptionalString` | Normalizes optional string inputs by trimming them and returning `null` when empty. |
| `parseOptionalDate` | Parses an optional date input into a `Date` or `null`. |
| `toDateInputValue` | Formats a `Date` into a `YYYY-MM-DD` string for the edit-prices UI. |
| `isMissingProductConfigColumnError` | Detects missing product-config columns during schema transitions, including `allowModelNumber`. |
| `findPriceListItemById` | Loads one price-list item with its related product and option data. |
| `PATCH` | Updates the price-list item, option, and product settings in one request. Delivery pricing (`deliveryTypes`, `autoDeliveryPrice`, `customSections`) is saved on the item's own price list via `savePriceListProductConfig`, so it never changes other price lists; product-wide settings (name, type, `allow*` flags) are still saved on `Product`. The response returns delivery pricing as seen by the item's price list. |
