# WordPress Order Attachment Import Script

## Source

- `scripts/import-wordpress-order-attachments.ts`

## Responsibility

Runs the separate WordPress historical attachment import phase after orders exist. It defaults to dry-run, supports the same paging, single-order, post-type, custom-endpoint, and `--debug` options as the order import, uploads files to S3, and creates or updates `OrderAttachment` rows with `s3://` storage paths.

## Functions

| Function | Description |
| --- | --- |
| `main` | Parses CLI options, runs the attachment import phase, logs imported, skipped, failed, uploaded, and failed WordPress ids, and exits non-zero when failures occur. |
