# WordPress Attachment Storage

## Source

- `lib/orders/wordpressAttachmentStorage.ts`

## Responsibility

Downloads WordPress-imported attachment files into local app storage under `public/uploads/orders/{orderId}/wordpress/`, preserves the original WordPress URL as `sourceUrl`, and upserts `OrderAttachment` metadata without storing file binaries in Postgres.

## Functions

| Function | Description |
| --- | --- |
| `localUploadFileExists` | Checks whether an existing `/uploads/...` storage path still exists on disk. |
| `copyWordpressAttachmentToLocalStorage` | Fetches a WordPress attachment, validates response status and size, detects the response MIME type, writes the file locally, and returns stored metadata. |
| `upsertWordpressOrderAttachment` | Reuses an existing local copy when present, otherwise downloads and stores the WordPress file, then creates or updates the `OrderAttachment` row while preserving `sourceUrl`. |

