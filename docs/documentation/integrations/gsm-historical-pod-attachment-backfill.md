# GSM Historical POD Attachment Backfill

## Source

- `scripts/backfill-historical-gsm-pod-attachments.ts`

## Responsibility

Recovers proof-of-delivery PDFs for historically imported WordPress orders whose GSM task ids were stored in `legacyWordpressRawMeta` instead of `OrderGsmTask`. The script extracts task ids from `gsm_attachment_download_links`, `gsm_task_id`, and `_gsmtasks_note_added_*` postmeta keys, falls back to raw UUID candidates when no known GSM field exists, downloads available POD PDFs from GSM, uploads them to S3, creates or updates `OrderAttachment` rows, skips existing PODs by `gsmTaskId` and `gsmDocumentId`, reuses existing POD-looking attachments whose filename or source URL contains the task id, and upserts `OrderGsmTask` metadata when applying.

## Functions

| Function | Description |
| --- | --- |
| `parseArgs` | Reads dry-run/apply, limit, force, and legacy WordPress order filters from CLI arguments. |
| `getHistoricalGsmTaskCandidates` | Extracts distinct historical GSM task candidates from imported WordPress raw metadata. |
| `fetchGsmTask` | Fetches GSM task metadata for state, reference, category, address, and GSM order id. |
| `fetchPodPdfBuffer` | Downloads POD PDF bytes from GSM for one task id. |
| `upsertGsmTask` | Creates or updates the local `OrderGsmTask` row for a recovered task. |
| `findExistingPodAttachment` | Finds an existing POD attachment by GSM identity or by a POD filename/source URL containing the task id. |
| `main` | Scans candidates, skips existing POD attachments by GSM identity unless forced, logs dry-run recoveries, uploads PDFs in apply mode, and prints summary counters. |

## Usage

- Dry-run all candidates: `npm run backfill:gsm-historical-pod-attachments`
- Dry-run sample: `npm run backfill:gsm-historical-pod-attachments -- --limit 10`
- Apply sample: `npm run backfill:gsm-historical-pod-attachments -- --apply --limit 10`
- Apply one legacy order: `npm run backfill:gsm-historical-pod-attachments -- --apply --legacy-wordpress-order-id 17755`
- Debug one legacy order's imported metadata shape: `npm run backfill:gsm-historical-pod-attachments -- --legacy-wordpress-order-id 17755 --debug`
- Re-download existing recovered attachments: `npm run backfill:gsm-historical-pod-attachments -- --apply --force`
