# WordPress Orders Route

## Source

- `app/api/integrations/wordpress/orders/route.ts`

## Responsibility

Imports legacy WordPress `power_order` posts into the new `Order` table. The route authenticates the sync secret, maps the legacy WordPress author to an active membership, resolves contact fields through multiple legacy key aliases, normalizes legacy delivery dates, time windows, lift values, and statuses into the editor’s native formats, parses legacy product and service rows from any WordPress repeater prefix that ends in `_velg_produkt`, reads install and return selections from both repeater meta and `price_breakdown_html`, converts recognized WordPress products into native product cards, rebuilds native `OrderItem` rows, keeps the original WordPress labels in `rawData`, and creates fallback rows when a WordPress product or service cannot be matched to the booking catalog.

## Functions

| Function | Description |
| --- | --- |
| `asString` | Normalizes unknown sync payload values into trimmed strings. |
| `getFirstMetaString` | Returns the first non-empty string found across a list of possible legacy WordPress meta keys. |
| `normalizeWhitespace` | Collapses repeated whitespace when parsing legacy labels. |
| `decodeHtmlEntities` | Decodes the HTML entities commonly produced by the legacy WordPress breakdown markup. |
| `stripHtml` | Removes HTML tags from legacy breakdown fragments before label parsing. |
| `cleanLegacyBreakdownLabel` | Converts legacy `price:label:code` and `Label (CODE)` strings into a user-facing label. |
| `parseBreakdownLabelAndCode` | Extracts a cleaned label plus an optional code from a breakdown row. |
| `cleanDeliveryType` | Removes the numeric pricing prefix from legacy delivery-type values. |
| `cleanLegacyProductName` | Normalizes WordPress product choice values such as `750:Pall:PALLS1` into a catalog-friendly product label. |
| `normalizeImportedDate` | Converts WordPress delivery dates such as `20260425` or `25.04.2026` into the editor’s `YYYY-MM-DD` format. |
| `normalizeImportedTimeWindow` | Collapses spaced legacy time ranges into the editor’s `HH:mm-HH:mm` format. |
| `normalizeImportedLift` | Maps legacy lift values such as `JA` and `NEI` onto the editor’s `yes` and `no` radio values. |
| `normalizeImportedStatus` | Maps WordPress status labels onto the booking app’s canonical lowercase status keys. |
| `getIndexedMetaString` | Reads a product repeater subfield by prefix, index, and a set of possible field suffixes. |
| `buildProductItemsFromMeta` | Builds parsed product rows from the flattened WordPress repeater meta. |
| `parseBreakdownGroups` | Splits `price_breakdown_html` into product groups and row labels. |
| `isSummaryLabel` | Filters out summary rows such as `Total`, `MVA`, and `Rabatt`. |
| `isDeliveryTypeRow` | Detects rows that represent a delivery type rather than a service option. |
| `classifyServiceItemType` | Maps parsed legacy service rows to `INSTALL_OPTION`, `RETURN_OPTION`, or `EXTRA_OPTION`. |
| `getMetaStringList` | Normalizes a WordPress meta value into a list of non-empty strings so repeater arrays and scalar fields share the same service parser. |
| `looksLikeLegacyServiceValue` | Filters repeater subfield values so plain counters do not get mistaken for service rows. |
| `buildServiceItemsFromMeta` | Parses install and return selections directly from structured WordPress repeater meta when the HTML breakdown is missing or incomplete. |
| `buildServiceItemsFromBreakdown` | Creates parsed service rows from `price_breakdown_html`, linked back to the parsed product card ids. |
| `dedupeServiceItems` | Removes duplicate service rows when the same legacy option is present in both structured meta and the HTML breakdown. |
| `buildServicesSummary` | Builds a counted `servicesSummary` string from the parsed legacy service rows. |
| `attachServiceLabelsToProductItems` | Adds grouped install, return, and extra labels onto each parsed product row so the imported product raw data keeps the original WordPress context. |
| `toJsonRecord` | Normalizes JSON-like raw data into a record shape before the importer merges WordPress labels into native items. |
| `buildResolvedServiceKey` | Creates a stable key for matching resolved WordPress services against native built items. |
| `buildServiceSignature` | Creates a stable key for matching parsed WordPress service rows against fallback or supplemental rows. |
| `buildResolvedServiceQueues` | Groups resolved WordPress services into per-item queues so native items can consume them without losing duplicates. |
| `takeResolvedServiceMatch` | Pulls the next matching resolved service for a native built item. |
| `buildProductRawDataLookup` | Maps parsed product card ids to their WordPress raw-data payloads. |
| `buildParsedServiceLookup` | Groups parsed WordPress service raw-data payloads by signature for later reuse. |
| `takeParsedServiceRawData` | Pulls the next matching parsed service raw-data payload for a fallback or supplemental row. |
| `enrichNativeItemsWithWordpressRawData` | Merges WordPress install and return labels into the native `OrderItem` rows built from mapped product cards. |
| `buildSupplementalResolvedServiceItems` | Creates extra imported rows for mapped WordPress services that the native card builder does not emit on its own. |
| `buildFallbackImportedItems` | Creates fallback imported rows for unmatched WordPress products and services. |
| `toCreateManyItem` | Normalizes imported item data into the Prisma `createMany` shape used by the importer transaction. |
| `POST` | Validates the request, resolves the legacy author membership, normalizes legacy field formats, maps WordPress products and service choices to native catalog cards, creates or updates the imported order, stores the product-card snapshot, and recreates the imported `OrderItem` rows on every sync. |
