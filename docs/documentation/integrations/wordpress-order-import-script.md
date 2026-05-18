# WordPress Order Import Script

## Source

- `scripts/import-wordpress-orders.ts`

## Responsibility

Runs the one-time historical WordPress order fetch/import. The script defaults to dry-run, supports `--apply`, `--from-page N`, `--limit-pages N`, `--order-id ID`, and `--debug`, fetches old WordPress orders plus postmeta, then posts each payload into the unchanged live WordPress sync handler. Page imports keep the exact fetched non-trash page IDs, skip `trash` posts before import and verification, stop on page failures, report failed IDs, and verify DB legacy IDs against the fetched page IDs instead of replacing failed orders with later orders. The verification always prints `fetchedPageIds`, `dbIds`, `missingIds`, and `extraIds`. Single-order imports fall back to the collection shell post plus postmeta endpoint when direct `/power_order/{id}` returns 401 or 403. Set `WORDPRESS_ORDER_POST_TYPE=power_order` to fetch `/wp-json/wp/v2/power_order`; set `WORDPRESS_ORDER_REST_PATH` to a custom endpoint path if the CPT is not exposed through REST.

## Functions

| Function | Description |
| --- | --- |
| `main` | Parses CLI options, runs the historical order import, logs summary counts and failed WordPress ids, and exits non-zero when failures occur. |

## Usage

- Single order test: `tsx scripts/import-wordpress-orders.ts --order-id 123`
- Single order debug test: `tsx scripts/import-wordpress-orders.ts --debug --order-id 123`
- Single order write: `tsx scripts/import-wordpress-orders.ts --apply --order-id 123`
- One page write: `tsx scripts/import-wordpress-orders.ts --apply --from-page 1 --limit-pages 1`
- Full write: `tsx scripts/import-wordpress-orders.ts --apply`
- NPM alias: `npm run import:wordpress-orders -- --apply --order-id 123`

## Environment

- `WORDPRESS_ORDER_POST_TYPE=power_order`
- Optional shell-order endpoint fallback: `WORDPRESS_ORDER_REST_PATH=/wp-json/otman/v1/power_order`
- Postmeta endpoint fallback: `WORDPRESS_POSTMETA_REST_PATH=/wp-json/otman/v1/postmeta`
- Optional postmeta endpoint shared secret: `WORDPRESS_POSTMETA_REST_SECRET`, sent as `x-otman-postmeta-secret`
- Sync route secret: `WORDPRESS_SYNC_SECRET`, sent internally as `x-wp-sync-secret`
- Current WordPress DB table prefix for fallback endpoint/import work: `WORDPRESS_DB_TABLE_PREFIX=21gLt_`
