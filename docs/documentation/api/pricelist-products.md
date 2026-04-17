# Price List Products API

## Source

- `app/api/products/pricelists/[pricelistId]/products/route.ts`

## Responsibility

Creates new products inside a price list with a default product option and returns the normalized row used by the edit-prices screen.

## Functions

| Function | Description |
| --- | --- |
| `generateCode` | Creates fallback product and option codes when the request does not supply them. |
| `centsToNokString` | Converts cent values into whole-number NOK strings for the API response. |
| `POST` | Creates a new product, applies the default product settings, creates the first option/item row, and returns the new edit-prices row. New products now default `allowModelNumber` to `true`. |
