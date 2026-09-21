# `lib/content/websiteOrderCatalog.ts`

## Purpose
Server side of the website order flow's catalogs (website only; the dashboard keeps using `getBookingCatalog`).

## Functions
- `listSeededWebsiteCatalogs()` — registry catalogs whose price list exists in this environment, in registry order.
- `getWebsiteCatalogPart(code)` — one list's own products (dashboard products and other lists' products filtered out), or null if not seeded.
- `getWebsiteOrderCatalog()` — every seeded list merged; throws if white goods is not seeded.
