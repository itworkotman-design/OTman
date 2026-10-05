# `lib/content/websiteCatalogs.ts`

## Purpose
Registry of the price lists a website customer can order from, in offer order (white goods first — it supplies the order-level fees — then furniture, then parcel/pallet). Adding a catalog here (plus its seed) is what makes it appear in the order flow.

Every catalog here plugs into the shared `WhiteGoodsBookingFlow`/`WhiteGoodsProductCard` "any other products?" cart. Not every website product category is registered here, though — Moving (`lib/content/movingCatalog.ts`) deliberately isn't, since its flat "pick one size bracket" price doesn't fit this delivery+install-options shape; see `docs/homepage-ordering-roadmap.md` §6.

## Functions
- `getWebsiteCatalog(code)` — catalog by price list code, or null.
- `findWebsiteCatalogByProductCode(code)` / `findWebsiteProductSeed(code)` / `findWebsiteOptionSeed(productCode, optionCode)` — lookups across every catalog (null for products not sold on the website). `findWebsiteOptionSeed` also finds an option by its old long code.
- `remainingWebsiteCatalogs(usedCodes)` — catalogs not yet used.
