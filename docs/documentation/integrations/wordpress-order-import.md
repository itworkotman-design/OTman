# WordPress Order Import Helpers

## Source

- `lib/integrations/wordpress/orderImport.ts`

## Responsibility

Provides the fetch-based historical WordPress import workflow used by the import and verification scripts. It fetches shell posts from `/wp-json/wp/v2/{WORDPRESS_ORDER_POST_TYPE}`, so `WORDPRESS_ORDER_POST_TYPE=power_order` requests `/wp-json/wp/v2/power_order`, then fetches full postmeta rows from `WORDPRESS_POSTMETA_REST_PATH` or `WORDPRESS_ORDER_POSTMETA_REST_PATH`. A fetched page is treated as a fixed import set: `trash` posts are skipped and excluded from verification, failed importable IDs are reported, the import stops on that page, and later page results are never used as replacements. After an apply-mode page import, the helper compares the fetched non-trash page IDs with the top matching-count DB `legacyWordpressOrderId` values and always prints `fetchedPageIds`, `dbIds`, `missingIds`, and `extraIds`. The postmeta endpoint is required for `power_order` unless the shell order response embeds a `postmeta` array. It is the supported fallback when normal REST does not expose `21gLt_postmeta`; it should return rows shaped like `{ meta_key, meta_value }` for the requested `post_id`. When `WORDPRESS_POSTMETA_REST_SECRET` is set, postmeta requests include it as the `x-otman-postmeta-secret` header. The importer ignores underscore ACF field-reference keys, parses simple PHP serialized scalar/array values, normalizes historical postmeta into the same payload shape as live WordPress sync, and posts that payload into the original `POST /api/integrations/wordpress/orders` handler. The sync handler stores the WordPress post id as the order `displayId`, so historical imports and live sync use the same visible order number. WordPress attachment import also fetches postmeta so the historical `vedlegg` media-id field can be resolved through the WordPress media REST endpoint. This keeps product mapping, pricing, summaries, alerts, attachment recovery, and persistence on the existing sync system instead of refactoring or duplicating it. Debug mode logs shell REST URLs, response status, whether the postmeta endpoint is configured, whether the postmeta secret is configured, the exact postmeta URL, and the number of returned meta rows. The default documented WordPress DB table prefix for fallback custom endpoint work is `21gLt_`.

## Functions

| Function | Description |
| --- | --- |
| `fetchWordpressOrdersPage` | Fetches one WordPress REST orders page with `per_page=100` from the configured post-type or custom endpoint path and reads `X-WP-Total` / `X-WP-TotalPages` when present. |
| `fetchWordpressOrderById` | Fetches one legacy WordPress order for single-order test runs. |
| `getWordpressPostStatus` | Normalizes the shell post status string for page filtering. |
| `isTrashWordpressPost` | Detects `trash` shell posts so page imports skip them before import and verification. |
| `findWordpressOrderShellInPages` | Scans collection pages for a shell post when direct `/power_order/{id}` access is unauthorized. |
| `fetchWordpressOrderForImport` | Fetches one order directly, falling back to the collection shell post plus postmeta path on 401 or 403. |
| `fetchWordpressTotalOrderCount` | Reads the old WordPress total order count for verification. |
| `parseWordpressImportCliArgs` | Parses `--dry-run`, `--apply`, `--from-page`, `--limit-pages`, `--order-id`, and `--debug`. |
| `hasMetaValueContaining` | Checks historical postmeta fields for option or delivery code signals such as `RETURNSTORE` and `INDOOR`. |
| `normalizeHistoricalProductCardsSnapshot` | Removes generated `WordPress order prices` cards from historical snapshots and clears matched-card read-only warnings without changing live sync behavior. |
| `runWordpressOrderImport` | Imports or dry-runs historical orders, logging each fetched page's exact IDs, stopping on page failures, and verifying fetched IDs against DB legacy IDs after apply-mode page imports. |
| `postToOriginalWordpressSync` | Sends a fetched historical order payload to the unchanged WordPress sync route with `WORDPRESS_SYNC_SECRET`. |
| `upsertHistoricalWordpressOrder` | Fetches and merges postmeta for one historical order, builds the same payload shape the old app sends live, and posts it into the original WordPress sync handler unless running in dry-run mode. |
| `extractWordpressAttachmentCandidates` | Extracts attachment candidates from common `attachments` / `files` shapes in the WordPress order, meta, or ACF payload, skipping records with explicit GSM source or GSM IDs. |
| `collectVedleggAttachmentIds` | Extracts historical WordPress media IDs from the ACF `vedlegg` field, including PHP serialized integer arrays. |
| `fetchWordpressMediaAttachmentCandidate` | Fetches one WordPress media item by ID and converts it into an attachment import candidate, logging failures in debug mode. |
| `resolveWordpressAttachmentCandidates` | Combines direct attachment records with `vedlegg` media records before importing attachments and logs resolved media IDs in debug mode. |
| `importWordpressOrderAttachments` | Uploads one order's WordPress attachments to S3 and upserts `OrderAttachment` rows by `(orderId, legacyWordpressAttachmentId)`. |
| `runWordpressAttachmentImport` | Runs attachment import across a single order or paginated WordPress order pages. |
| `verifyWordpressOrderImport` | Compares the WordPress total count with imported DB count and spot-checks stored totals against raw meta. |

## Postmeta Endpoint

Expected request:

- `GET /wp-json/otman/v1/postmeta?post_id=123&table_prefix=21gLt_`

Expected response:

```json
[
  { "meta_key": "slug_numeric_id", "meta_value": "77777" },
  { "meta_key": "extra_products_0_velg_produkt", "meta_value": "Vaskemaskin" }
]
```

Equivalent WordPress-side query:

```sql
SELECT meta_key, meta_value
FROM 21gLt_postmeta
WHERE post_id = ?
```
