# WordPress Orders Route

## Source

- `app/api/integrations/wordpress/orders/route.ts`

## Responsibility

Imports legacy WordPress `power_order` posts into the new `Order` table. The route authenticates the sync secret, maps the legacy WordPress author to an active membership, resolves contact fields through multiple legacy key aliases, parses legacy product and service rows from any WordPress repeater prefix that ends in `_velg_produkt`, converts recognized WordPress products into native product cards, rebuilds native `OrderItem` rows, keeps the original WordPress labels in `rawData`, and creates fallback rows when a WordPress product or service cannot be matched to the booking catalog.

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
| `getIndexedMetaString` | Reads a product repeater subfield by prefix, index, and a set of possible field suffixes. |
| `buildProductItemsFromMeta` | Builds parsed product rows from the flattened WordPress repeater meta. |
| `parseBreakdownGroups` | Splits `price_breakdown_html` into product groups and row labels. |
| `isSummaryLabel` | Filters out summary rows such as `Total`, `MVA`, and `Rabatt`. |
| `isDeliveryTypeRow` | Detects rows that represent a delivery type rather than a service option. |
| `classifyServiceItemType` | Maps parsed legacy service rows to `INSTALL_OPTION`, `RETURN_OPTION`, or `EXTRA_OPTION`. |
| `buildServiceItemsFromBreakdown` | Creates parsed service rows from `price_breakdown_html`, linked back to the parsed product card ids. |
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
| `POST` | Validates the request, resolves the legacy author membership, maps WordPress products and install choices to native catalog cards, creates or updates the imported order, stores the product-card snapshot, and recreates the imported `OrderItem` rows on every sync. |
