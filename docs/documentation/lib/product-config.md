# Product Config

## Source

- `lib/products/productConfig.ts`

## Responsibility

Loads product-level configuration flags from the database and normalizes product delivery/custom-section config for booking and price-list APIs.

Delivery pricing (`deliveryTypes`, `autoDeliveryPrice`, `customSections`) is per price list: it lives in `PriceListProductConfig` (one row per price list + product). Each field falls back to the matching `Product` column when the price list has no value. The on/off flags (`allow*`, `productType`, `autoXtraPerPallet`) stay on `Product` and are shared by all price lists.

## Functions

| Function | Description |
| --- | --- |
| `isMissingProductConfigColumnError` | Detects missing product-config database columns during transitional schema states, including `deliveryTypes` and `allowModelNumber`. |
| `getProductConfigMap` | Fetches product config rows by product id and returns them as a lookup map. Takes a required `priceListId`: delivery pricing comes from that price list's `PriceListProductConfig` row, per field, falling back to the product. Pass `null` only for flows not tied to a price list. Falls back to `allowModelNumber = true` when the column is not available yet. |
| `savePriceListProductConfig` | Upserts the provided delivery-pricing fields on a price list's own row for a product. Never writes the shared `Product` row. |
| `copyPriceListProductConfigs` | Copies all of one price list's per-product delivery pricing onto another (used when a price list is created from a source list). |
