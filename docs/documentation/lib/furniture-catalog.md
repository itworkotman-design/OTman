# `lib/content/furnitureCatalog.ts`

## Purpose
Types and the exported product list for the website furniture catalog (`WEBSITE_FURNITURE` price list). Same shape as the white-goods seed so both share one seeding routine. Source workbook: "Otman_furniture_product_options_2026_FINAL(2).xlsx".

## Exports
### `FURNITURE_PRODUCTS`
The 23 furniture products, from `furnitureCatalogData.ts`.

### `FurnitureOptionSeed` / `FurnitureProductSeed`
Extend the white-goods seed types. Assembly options carry `typeEn/typeNo` and `manufacturer/manufacturerNo` (a "Single bed — IKEA" choice is one option). A product may carry `needsImplementation` (Other furniture: assembly needs a manual quote) — shown as a disabled note, never seeded as a priced option.

### `FURNITURE_PRICE_LIST_CODE`
Re-exported from `websitePriceListCodes.ts`.
