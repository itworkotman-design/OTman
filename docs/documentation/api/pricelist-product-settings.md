# Price List Product Settings API

## Source

- `app/api/products/pricelists/[pricelistId]/products/[productId]/settings/route.ts`

## Responsibility

Saves the settings (including delivery-type prices) and renames (`name`, trimmed, non-empty) a delivery-only product — one with no options, so no `PriceListItem` for `items/[itemId]/full` to update through. Only products linked to the price list via `PriceListProduct` are editable (404 otherwise). Owner/Admin only.

## Functions

| Function | Description |
| --- | --- |
| `PATCH` | Checks the `PriceListProduct` link (404 if absent), runs the raw `Product` config update, and returns the refreshed product config. |
