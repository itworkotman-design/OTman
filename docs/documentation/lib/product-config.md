# Product Config

## Source

- `lib/products/productConfig.ts`

## Responsibility

Loads product-level configuration flags from the database and normalizes product delivery/custom-section config for booking and price-list APIs.

## Functions

| Function | Description |
| --- | --- |
| `isMissingProductConfigColumnError` | Detects missing product-config database columns during transitional schema states, including `deliveryTypes` and `allowModelNumber`. |
| `getProductConfigMap` | Fetches product config rows by product id and returns them as a lookup map. It now includes `allowModelNumber` and falls back to `true` when the column is not available yet. |
