# `lib/content/furnitureCatalog.ts`

## Purpose
Types and the exported product list for the website furniture catalog (`WEBSITE_FURNITURE` price list). Same shape as the white-goods seed so both share one seeding routine. Source workbook: "Otman_furniture_product_options_2026_FINAL(2).xlsx".

## Exports
### `FURNITURE_PRODUCTS`
The 23 furniture products, from `furnitureCatalogData.ts`. The recycling return (`RETURN_RECYCLING`) is sold at half the workbook price, customer and partner. The workbook's per-type dismantling list is replaced by `FURNITURE_DISMANTLING_OPTIONS` on every product that has dismantling (both decided 2026-10-23). Dining set, Sofa and Sofa bed (the heavy "Side-by-Side" items) are sold at 25% off the workbook's customer delivery price (partner price unchanged), and a 2nd+ one gets the normal furniture extra-item rate instead of full price (`withLighterHeavyDelivery`, decided 2026-11-02). All of these are applied here, not in the generated data file, so a regeneration keeps them.

### `FURNITURE_DISMANTLING_OPTIONS`
The two shared dismantling choices, no sizes, ex. VAT (customer / partner): `DISMANTLE_DISP_STD` for disposal 480 / 335, `DISMANTLE_CAR_STD` for reuse 720 / 505 (600 / 900 incl. VAT). The seed deactivates every other `DISMANTLE_*` option (`retireMissingOptionsWithPrefix`).

### `FurnitureOptionSeed` / `FurnitureProductSeed`
Extend the white-goods seed types. Assembly options carry `typeEn/typeNo` and `manufacturer/manufacturerNo` (a "Single bed — IKEA" choice is one option). A product may carry `needsImplementation` (Other furniture: assembly needs a manual quote) — shown as a disabled note, never seeded as a priced option.

### `FURNITURE_PRICE_LIST_CODE`
Re-exported from `websitePriceListCodes.ts`.
