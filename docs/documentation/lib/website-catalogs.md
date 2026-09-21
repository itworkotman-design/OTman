# `lib/content/websiteCatalogs.ts`

## Purpose
Registry of the price lists a website customer can order from, in offer order (white goods first — it supplies the order-level fees — then furniture). Adding a catalog here (plus its seed) is what makes it appear in the order flow.

## Functions
- `getWebsiteCatalog(code)` — catalog by price list code, or null.
- `findWebsiteCatalogByProductCode(code)` / `findWebsiteProductSeed(code)` / `findWebsiteOptionSeed(productCode, optionCode)` — lookups across every catalog (null for products not sold on the website).
- `remainingWebsiteCatalogs(usedCodes)` — catalogs not yet used.
