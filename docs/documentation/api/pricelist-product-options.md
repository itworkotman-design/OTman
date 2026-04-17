# Price List Product Options API

## Source

- `app/api/products/pricelists/[pricelistId]/products/[productId]/options/route.ts`

## Responsibility

Creates a new product option under an existing product and returns the normalized edit-prices row for that option.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Creates the product option, creates the linked price-list item, loads product config, and returns the combined response row. The returned product config now includes `allowModelNumber`. |
