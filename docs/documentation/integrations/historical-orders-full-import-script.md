# Historical Orders Full Import Script

## Source

- `scripts/import-historical-orders-full.ts`

## Responsibility

Runs the historical import pipeline as one command. The script imports WordPress orders, optionally imports WordPress attachments, optionally recovers historical GSM POD PDFs, and verifies the WordPress order count after apply mode.

## Functions

| Function | Description |
| --- | --- |
| `parsePositiveInteger` | Parses positive numeric CLI arguments. |
| `parseFullImportArgs` | Reads full import flags for WordPress order import, WordPress attachment import, and GSM POD recovery. |
| `getWordpressOptions` | Converts full import options into the shared WordPress import option shape. |
| `toBackfillMode` | Passes the dry-run/apply mode through to the GSM POD backfill step. |
| `main` | Runs WordPress order import, WordPress attachment import, GSM POD backfill, verification, and final exit status handling. |

## Usage

- Dry-run full pipeline: `npm run import:historical-orders-full`
- Apply full pipeline: `npm run import:historical-orders-full -- --apply`
- Apply sample pages and GSM sample: `npm run import:historical-orders-full -- --apply --limit-pages 2 --gsm-limit 20`
- Apply one WordPress order and its GSM PODs: `npm run import:historical-orders-full -- --apply --order-id 17697`
- Skip WordPress attachments: `npm run import:historical-orders-full -- --apply --skip-wordpress-attachments`
- Skip GSM POD recovery: `npm run import:historical-orders-full -- --apply --skip-gsm-pods`
