# Order Attachment Storage

## Source

- `lib/orders/orderAttachmentStorage.ts`

## Responsibility

Centralizes S3-backed order attachment storage. The helper detects whether S3 storage is configured, stores new files and generated buffers as `s3://...` paths, generates short-lived signed URLs for inline open/download access, downloads S3-backed files for route fallbacks, and deletes S3 objects when attachments are removed.

## Functions

| Function | Description |
| --- | --- |
| `isS3AttachmentStorageConfigured` | Returns whether all required S3 attachment environment variables are present. |
| `isS3StoragePath` | Checks whether a stored attachment path points at an S3 object. |
| `uploadAttachmentToS3` | Uploads a file to S3 under an order-scoped key and returns its storage path. |
| `uploadAttachmentBufferToS3` | Uploads generated attachment bytes, such as GSM POD PDFs, to S3 under an order-scoped key and returns its storage path. |
| `downloadAttachmentFromS3` | Downloads an S3-backed attachment and returns its bytes, content type, and size. |
| `deleteAttachmentFromS3` | Deletes an S3-backed attachment object when its app record is removed. |
| `getSignedAttachmentUrl` | Builds a short-lived signed S3 URL for inline open or forced download access. |
| `getAttachmentAccessUrls` | Returns the correct open and download URLs for an attachment, using signed URLs for both S3-backed open and download links and route URLs otherwise. |

## Temp staging (added 2026-09-28)
- `uploadTempAttachmentBufferToS3` — same as `uploadAttachmentBufferToS3` but
  keys under `tmp/` (expired by an S3 lifecycle rule) instead of `orders/`.
- `tempKeyToOrderKey(key)` — `tmp/<rest>` → `orders/<rest>`, `null` otherwise.
- `promoteTempAttachmentToOrders(storagePath)` — CopyObject to the `orders/`
  key, then delete the tmp object (delete failure is swallowed; lifecycle rule
  removes it). Returns the new `s3://` path; throws on a failed copy or a
  non-tmp path.
