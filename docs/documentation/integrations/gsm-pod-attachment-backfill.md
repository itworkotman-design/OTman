# GSM POD Attachment Backfill

## Source

- `scripts/backfill-gsm-pod-attachments-to-s3.ts`

## Responsibility

One-time backfill for GSM proof-of-delivery attachments that were saved under local `/uploads/orders/...` storage before GSM POD sync used S3. The script finds `OrderAttachment` rows with `source = "GSM"` and a local upload path in `storagePath` or `sourceUrl`, verifies the local file still exists, uploads existing files through the shared order attachment S3 helper, updates `storagePath` to the returned `s3://...` value, and skips missing local files.

## Functions

| Function | Description |
| --- | --- |
| `getMode` | Reads command-line flags and defaults to dry-run unless `--apply` is provided. |
| `getLocalUploadPath` | Resolves a `/uploads/orders/...` path to a safe file path inside `public/uploads`. |
| `localFileExists` | Checks whether the resolved local path exists and is a file. |
| `main` | Scans GSM attachment rows in batches, logs dry-run actions, uploads existing local files to S3 in apply mode, updates `storagePath`, and prints summary counters. |

## Usage

- Dry-run: `npm run backfill:gsm-pod-attachments`
- Apply: `npm run backfill:gsm-pod-attachments -- --apply`
