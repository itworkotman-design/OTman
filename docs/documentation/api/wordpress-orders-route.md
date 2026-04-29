# WordPress Orders Route

## Source

- `app/api/integrations/wordpress/orders/route.ts`

## Responsibility

Imports legacy WordPress `power_order` posts into the new `Order` table. The route authenticates the sync secret, maps the legacy WordPress author to an active membership, maps the selected WordPress subcontractor onto an active subcontractor membership when it matches an existing user, preserves imported created and modified timestamps, resolves contact fields through multiple legacy key aliases, normalizes legacy delivery dates, time windows, lift values, statuses, and Norwegian deviation values into the editor's native formats, reads status from `status`, `order_status`, or `post_status`, reconstructs legacy extra pickup addresses from both nested repeater data and flattened ACF meta keys, preserves legacy express-delivery state from the saved checkbox, from `price_breakdown_html`, or from parsed express service rows, parses legacy product and service rows from any WordPress repeater prefix that ends in `_velg_produkt`, reads install and return selections from both structured repeater labels and checkbox-style truthy legacy fields including fixed ACF field ids such as the old return selector, compares each WP product group total against the mapped native product total, keeps exact matches editable, stores mismatches as gray read-only WordPress price snapshots, preserves WP KM and extra-pickup price rows as read-only snapshots, imports customer discounts, subcontractor minus adjustments, deviation fees, and hardcoded order fee fields while ignoring manual plus extras, rebuilds native `OrderItem` rows, keeps the original WordPress labels in `rawData`, stores imported distance and price totals, copies WordPress attachments into local app storage while preserving their original source URLs, and raises a manual-review alert when the imported WordPress ex-VAT total does not match the rebuilt native price.

## Functions

| Function | Description |
| --- | --- |
| `asString` | Normalizes unknown sync payload values into trimmed strings. |
| `getFirstMetaString` | Returns the first non-empty string found across a list of possible legacy WordPress meta keys. |
| `normalizeWhitespace` | Collapses repeated whitespace when parsing legacy labels. |
| `normalizeLookupValue` | Normalizes WordPress subcontractor labels and user identifiers for exact user matching. |
| `parseImportedDateTime` | Parses timezone-safe WordPress created and modified timestamps before they are written to `createdAt` and `updatedAt`. |
| `parseLegacyMoneyToCents` | Converts legacy WordPress money strings such as `10 000 NOK`, numeric totals, and array-wrapped field values into integer cents for importer comparisons. |
| `formatImportedAdjustment` | Converts imported adjustment cents back into the plain numeric string format stored on native orders. |
| `decodeHtmlEntities` | Decodes the HTML entities commonly produced by the legacy WordPress breakdown markup. |
| `stripHtml` | Removes HTML tags from legacy breakdown fragments before label parsing. |
| `cleanLegacyBreakdownLabel` | Converts legacy `price:label:code` and `Label (CODE)` strings into a user-facing label. |
| `parseBreakdownLabelAndCode` | Extracts a cleaned label plus an optional code from a breakdown row. |
| `parseLegacyServiceValuePriceCents` | Extracts the leading legacy service price from `price:label:code` values so catalog mapping can match return options by exact price when labels differ. |
| `cleanDeliveryType` | Removes the numeric pricing prefix from legacy delivery-type values. |
| `cleanLegacyProductName` | Normalizes WordPress product choice values such as `750:Pall:PALLS1` into a catalog-friendly product label. |
| `normalizeImportedDate` | Converts WordPress delivery dates such as `20260425` or `25.04.2026` into the editor's `YYYY-MM-DD` format. |
| `normalizeImportedTimeWindow` | Collapses spaced legacy time ranges into the editor's `HH:mm-HH:mm` format. |
| `normalizeImportedLift` | Maps legacy lift values such as `JA` and `NEI` onto the editor's `yes` and `no` radio values. |
| `normalizeImportedStatus` | Maps WordPress status labels onto the booking app's canonical lowercase status keys, including `fail` to `failed`. |
| `getIndexedMetaString` | Reads a product repeater subfield by prefix, index, and a set of possible field suffixes. |
| `buildProductItemsFromMeta` | Builds parsed product rows from the flattened WordPress repeater meta. |
| `parseBreakdownGroups` | Splits `price_breakdown_html` into product groups and row labels plus row prices. |
| `extractBreakdownRows` | Extracts flattened label and price pairs from legacy breakdown HTML so the importer can reuse summary rows outside grouped product parsing. |
| `findBreakdownRowValueCents` | Finds the last matching legacy summary row value for a set of label patterns and normalizes negative discount rows into positive adjustment amounts. |
| `isSummaryLabel` | Filters out summary and price-only rows such as `Total`, `MVA`, `Rabatt`, `Ekstra`, `Extra`, and `KM pris`. |
| `isDeliveryTypeRow` | Detects rows that represent a delivery type rather than a service option. |
| `classifyServiceItemType` | Maps parsed legacy service rows to `INSTALL_OPTION`, `RETURN_OPTION`, or `EXTRA_OPTION`. |
| `isGlobalFeeRow` | Detects legacy global fee rows such as `XTRAARBEID` and `ADDORDER` so they are not imported as product services. |
| `getMetaStringList` | Normalizes a WordPress meta value into a list of non-empty strings so repeater arrays and scalar fields share the same service parser. |
| `looksLikeLegacyServiceValue` | Filters repeater subfield values so plain counters do not get mistaken for service rows. |
| `hasTruthyLegacySelection` | Detects checkbox-style truthy legacy values such as `1`, `true`, and `ja` so the importer can recover service selections even when the old form stored no label in the value. |
| `normalizeLegacyServiceSuffix` | Converts a legacy repeater subfield suffix into a comparison-friendly label candidate. |
| `inferLegacyServiceFromMetaSuffix` | Rebuilds install, return, demont, and unpacking service rows from truthy legacy checkbox keys when the value itself does not contain a WordPress label or code string, including fixed ACF field ids used by the old return selector. |
| `buildServiceItemsFromMeta` | Parses install and return selections directly from structured WordPress repeater meta when the HTML breakdown is missing or incomplete, including checkbox-style truthy legacy fields whose labels live in the meta key. |
| `buildServiceItemsFromBreakdown` | Creates parsed service rows from `price_breakdown_html`, linked back to the parsed product card ids. |
| `isExpressServiceItem` | Detects parsed service rows that represent legacy express delivery so the importer can preserve express state even when the checkbox meta is missing. |
| `dedupeServiceItems` | Removes duplicate service rows when the same legacy option is present in both structured meta and the HTML breakdown. |
| `buildServicesSummary` | Builds a counted `servicesSummary` string from the parsed legacy service rows. |
| `parseDistanceKm` | Converts imported distance strings such as `125 km` into numeric kilometers for pricing flags. |
| `getImportedWordpressPriceExVatCents` | Reads the imported ex-VAT total from `total_price` or from supported ex-VAT summary labels in `price_breakdown_html`, while skipping `Total inkl. MVA`. |
| `getImportedWordpressAdjustments` | Reads legacy admin discount values from raw WordPress meta and subcontractor minus values from the saved subcontractor breakdown HTML, while leaving manual plus adjustments empty. |
| `parseLegacyInteger` | Converts WordPress scalar, array, or object-wrapped number values into positive integers for fee minute imports. |
| `getFirstLegacyInteger` | Returns the first positive integer found across a list of possible WordPress meta keys. |
| `normalizeWordpressAttachments` | Deduplicates incoming WordPress attachments by legacy attachment id and normalizes filename, MIME type, source URL, size, and category before local storage copy. |
| `resolveWordpressSubcontractorMembership` | Matches the selected WordPress subcontractor to an active subcontractor membership by legacy WordPress id, username, email, or email local-part. |
| `hasLegacySelection` | Checks whether any supported legacy checkbox key contains a truthy selected value. |
| `getBreakdownRowsWithCodes` | Extracts flattened breakdown rows with parsed labels, codes, and prices. |
| `getBreakdownCodeSignal` | Builds an uppercase code-and-label signal for matching legacy fee rows. |
| `isExtraPickupBreakdownRow` | Detects `EXTRAPICKUP` rows in WordPress breakdown HTML, including labels with trailing quantities such as `x1`. |
| `isKmBreakdownRow` | Detects global `KM pris` rows in WordPress breakdown HTML. |
| `isGlobalWordpressPriceRow` | Identifies global WordPress price rows that should not be included in per-product price matching. |
| `getExtraWorkBlocksFromLabel` | Reads the `xN` block count from a legacy extra-work fee label. |
| `getImportedWordpressFees` | Reads the extra-work fee checkbox, total minutes, and add-to-order fee checkbox from WordPress meta or breakdown HTML. |
| `getImportedWordpressDeviation` | Reads the legacy WordPress bomtur/deviation field or breakdown row and stores the matching canonical English deviation label. |
| `getProtectedFailureFeeCents` | Sums deviation, extra-work, and add-to-order fees that should remain chargeable when failed or cancelled orders auto-fill `rabatt`. |
| `isFailureDiscountStatus` | Detects imported cancelled and failed statuses that should auto-fill `rabatt`. |
| `getNativeCalculatedPricing` | Rebuilds the native ex-VAT and subcontractor totals from mapped product cards, the current booking catalog, imported admin adjustment fields, imported deviation fees, and imported hardcoded fee fields. |
| `getBreakdownGroupTotalCents` | Sums one WordPress product group total from its parsed breakdown rows. |
| `getNativeProductTotalCents` | Calculates one mapped native product card total for exact WP/native product price matching. |
| `toReadOnlyRows` | Converts parsed WordPress breakdown rows into saved read-only price rows, preserving parsed quantities and storing unit cents so display and order items can show multiplied WP lines correctly. |
| `applyWordpressPriceMatchPolicy` | Marks per-product WP/native price mismatches and WP KM or extra-pickup rows as read-only saved product-card snapshots while leaving exact matches editable. Global rows such as extra pickup are excluded from product matching and saved separately as `WordPress order prices`. |
| `syncWordpressPriceMismatchNotification` | Creates or resolves the WordPress manual-review alert when the imported total and rebuilt native total diverge. |
| `attachServiceLabelsToProductItems` | Adds grouped install, return, and extra labels onto each parsed product row so the imported product raw data keeps the original WordPress context. |
| `toJsonRecord` | Normalizes JSON-like raw data into a record shape before the importer merges WordPress labels into native items. |
| `buildResolvedServiceKey` | Creates a stable key for matching resolved WordPress services against native built items. |
| `buildServiceSignature` | Creates a stable key for matching parsed WordPress service rows against fallback or supplemental rows. |
| `buildResolvedServiceQueues` | Groups resolved WordPress services into per-item queues so native items can consume them without losing duplicates. |
| `cloneMappedProductCard` | Deep-clones mapped product cards before the importer reapplies resolved selections onto the saved snapshot. |
| `pushUniqueSelection` | Adds an option id to a saved-card selection array only when it is not already present. |
| `ensureResolvedSelectionsOnProductCards` | Re-applies resolved install, return, extra, demont, and custom-section selections onto the saved product-card snapshot before it is persisted. |
| `takeResolvedServiceMatch` | Pulls the next matching resolved service for a native built item. |
| `buildProductRawDataLookup` | Maps parsed product card ids to their WordPress raw-data payloads. |
| `buildParsedServiceLookup` | Groups parsed WordPress service raw-data payloads by signature for later reuse. |
| `takeParsedServiceRawData` | Pulls the next matching parsed service raw-data payload for a fallback or supplemental row. |
| `enrichNativeItemsWithWordpressRawData` | Merges WordPress install and return labels into the native `OrderItem` rows built from mapped product cards. |
| `buildSupplementalResolvedServiceItems` | Creates extra imported rows for mapped WordPress services that the native card builder does not emit on its own. |
| `buildFallbackImportedItems` | Creates fallback imported rows for unmatched WordPress products and services. |
| `toCreateManyItem` | Normalizes imported item data into the Prisma `createMany` shape used by the importer transaction. |
| `POST` | Validates the request, resolves the legacy author membership, resolves the selected WordPress subcontractor membership, preserves the imported modified timestamp as `updatedAt`, normalizes legacy field formats, reconstructs legacy extra pickup addresses and default extra-pickup contacts, preserves the imported express-delivery flag, maps WordPress products and service choices to native catalog cards, imports admin discount/minus adjustment fields while leaving manual plus extras empty for WordPress orders, imports deviation, extra-work, and add-to-order fee fields, auto-fills `rabatt` for failed or cancelled imported orders while leaving protected fees chargeable, stores mismatched product, KM, and extra-pickup WP prices as read-only snapshots, stores imported distance and price totals on the order, creates or resolves a WordPress price-mismatch alert when needed, creates or updates the imported order, stores the product-card snapshot, recreates the imported `OrderItem` rows on every sync, and upserts WordPress attachments by legacy id while copying files locally when needed. |
