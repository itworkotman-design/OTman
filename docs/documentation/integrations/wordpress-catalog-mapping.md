# WordPress Catalog Mapping

## Source

- `lib/integrations/wordpress/catalogMapping.ts`

## Responsibility

Maps parsed WordPress product rows and WordPress service rows onto the native booking catalog. The helper resolves catalog products from WordPress product names, translates WordPress delivery labels into native delivery types, maps generic or product-specific install labels to native install option codes, preserves return selections, converts hourly WordPress products into native cards with `hoursInput`, and returns both normalized product cards and any unresolved legacy rows that still need fallback handling.

## Functions

| Function | Description |
| --- | --- |
| `repairLegacyEncoding` | Normalizes common mojibake sequences before the mapper compares legacy WordPress labels to native catalog labels. |
| `normalizeKey` | Converts labels, aliases, and codes into a stable lowercase comparison key. |
| `matchesAlias` | Checks whether an input value matches any configured alias after normalization. |
| `decimalStringToCents` | Converts decimal string prices into integer cents for resolved service metadata. |
| `pushUnique` | Appends an id to a selection array only when it is not already present. |
| `getProductMapping` | Resolves the config entry that describes a native catalog product and its related WordPress aliases. |
| `resolveCatalogProduct` | Matches a parsed WordPress product name to a native catalog product. |
| `resolveDeliveryType` | Maps a parsed WordPress delivery label to a native delivery-type key. |
| `findProductOption` | Resolves a native catalog option by option code on a specific product. |
| `findSpecialOption` | Resolves a native catalog special option by option code. |
| `resolveInstallAlias` | Maps a generic WordPress install label or code to a product-specific native install option code. |
| `buildResolvedService` | Builds the resolved service metadata payload returned to the importer route. |
| `resolveSpecialServiceCode` | Maps WordPress return or extra-service labels to shared native service codes. |
| `resolveService` | Resolves a parsed WordPress service row to a native install, return, or extra option when possible. |
| `mapWordpressImportToProductCards` | Converts parsed WordPress products and services into native saved product cards, including return selections and hourly-card `hoursInput`, plus resolved service metadata and unresolved fallback rows. |
