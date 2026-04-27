# WordPress Catalog Mapping

## Source

- `lib/integrations/wordpress/catalogMapping.ts`

## Responsibility

Maps parsed WordPress product rows and WordPress service rows onto the native booking catalog. The helper resolves catalog products from WordPress product names, translates WordPress delivery labels into native delivery types, infers install-only or return-only delivery types from service rows when the product row has no explicit delivery type, maps generic or product-specific install labels to native install option codes only for actual legacy install rows, checks native option codes directly when the legacy label text differs, runs configured code aliases for hardcoded WordPress codes such as `RETURNSBSSTORE`, preserves return selections, can resolve return options by exact price when old labels or codes no longer match, maps hardcoded WordPress return codes into native custom-section selections, converts hourly WordPress products into native cards with `hoursInput`, and returns both normalized product cards and any unresolved legacy rows that still need fallback handling.

## Functions

| Function | Description |
| --- | --- |
| `repairLegacyEncoding` | Normalizes common mojibake sequences before the mapper compares legacy WordPress labels to native catalog labels. |
| `normalizeKey` | Converts labels, aliases, and codes into a stable lowercase comparison key. |
| `matchesAlias` | Checks whether an input value matches any configured alias after normalization. |
| `matchesOptionCode` | Compares legacy and native option codes through the same normalization path so code matches still work when labels differ. |
| `getOptionCodeCandidates` | Expands a WordPress service code into the exact code plus any configured alias candidates before option resolution runs. |
| `decimalStringToCents` | Converts decimal string prices into integer cents for resolved service metadata. |
| `getEffectiveCustomerPriceCents` | Converts the effective customer price for a native option into integer cents for price-based matching. |
| `pushUnique` | Appends an id to a selection array only when it is not already present. |
| `getProductMapping` | Resolves the config entry that describes a native catalog product and its related WordPress aliases. |
| `resolveCatalogProduct` | Matches a parsed WordPress product name to a native catalog product. |
| `resolveDeliveryType` | Maps a parsed WordPress delivery label to a native delivery-type key. |
| `findProductOption` | Resolves a native catalog option by option code on a specific product. |
| `findSpecialOption` | Resolves a native catalog special option by option code. |
| `findReturnSpecialOptionByPrice` | Resolves a return special option by exact effective customer price when WordPress label or code matching fails. |
| `findCustomSectionOption` | Resolves a native custom-section option by code so hardcoded legacy return rows can land in `customSectionSelections`. |
| `resolveInstallAlias` | Maps a generic WordPress install label or code to a product-specific native install option code. |
| `buildResolvedService` | Builds the resolved service metadata payload returned to the importer route. |
| `resolveSpecialServiceCode` | Maps WordPress return or extra-service labels to shared native service codes. |
| `resolveService` | Resolves a parsed WordPress service row to a native install, return, extra, or custom-section option when possible, including return-option price matching, while keeping non-install legacy rows from being promoted into install selections through generic install aliases. |
| `mapWordpressImportToProductCards` | Converts parsed WordPress products and services into native saved product cards, including inferred install-only or return-only delivery types, return selections, hourly-card `hoursInput`, custom-section selections matched by code, plus resolved service metadata and unresolved fallback rows. |
