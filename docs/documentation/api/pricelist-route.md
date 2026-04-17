# Price List API

## Source

- `app/api/products/pricelists/[pricelistId]/route.ts`

## Responsibility

Returns one price list together with all normalized product rows and special-option rows used by the edit-prices page.

## Functions

| Function | Description |
| --- | --- |
| `centsToNokString` | Converts cent values into whole-number NOK strings for API responses. |
| `toDateInputValue` | Formats a `Date` into the `YYYY-MM-DD` string expected by the edit-prices UI. |
| `GET` | Loads the selected price list, merges product-config overrides, and returns normalized product/special-option rows. Product rows now expose `allowModelNumber`. |
| `PATCH` | Updates top-level price-list metadata and settings. |
