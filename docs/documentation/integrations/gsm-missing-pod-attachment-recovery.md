# GSM Missing POD Attachment Recovery

## Source

- `scripts/backfill-missing-gsm-pod-attachments-from-gsm.ts`

## Responsibility

One-time recovery for GSM proof-of-delivery attachments whose database rows still point at local `/uploads/orders/...` files that no longer exist. The script finds `OrderAttachment` rows with `source = "GSM"` and a local upload path in `storagePath` or `sourceUrl`, skips rows where the local file still exists, uses `gsmTaskId` and `gsmDocumentId` to identify POD records, re-downloads the POD PDF from GSM, uploads it through shared S3 attachment storage, updates `storagePath` to `s3://...`, and logs failures.

## Functions

| Function | Description |
| --- | --- |
| `getMode` | Reads command-line flags and defaults to dry-run unless `--apply` is provided. |
| `getLocalUploadPath` | Resolves a `/uploads/orders/...` path to a safe file path inside `public/uploads`. |
| `localFileExists` | Checks whether the resolved local path exists and is a file. |
| `isPodDocumentForTask` | Verifies that a stored `gsmDocumentId` matches the expected `pod:{gsmTaskId}` POD document shape. |
| `fetchPodPdfBuffer` | Authenticates to GSM and downloads the POD PDF bytes for the stored task id. |
| `main` | Scans GSM attachment rows in batches, skips existing local files and unsupported records, logs dry-run recovery actions, re-downloads missing POD PDFs in apply mode, uploads them to S3, and updates `storagePath`. |

## Usage

- Dry-run: `npm run backfill:gsm-missing-pod-attachments`
- Apply: `npm run backfill:gsm-missing-pod-attachments -- --apply`
