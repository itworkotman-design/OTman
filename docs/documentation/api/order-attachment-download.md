# Order Attachment Download Route

## Source

- `app/api/orders/[orderId]/attachments/[attachmentId]/download/route.ts`

## Responsibility

Serves order attachment files through an authenticated endpoint. The route checks active-company access to the order, reads the file from local upload storage, and falls back to the stored WordPress source URL when an imported local copy is missing.

## Functions

| Function | Description |
| --- | --- |
| `getLocalUploadPath` | Resolves a `/uploads/...` storage path to a safe path inside `public/uploads`. |
| `contentDispositionFilename` | Removes unsafe characters from filenames before they are written into the download header. |
| `getRemoteAttachmentUrl` | Validates that a stored source URL is an HTTP(S) URL before it can be used as a fallback. |
| `downloadRemoteAttachment` | Downloads a missing imported attachment from its stored source URL and returns its bytes, MIME type, and size. |
| `GET` | Validates the session and order access, loads attachment metadata, returns the local file when present, or falls back to the stored remote source URL for missing WordPress-imported files. |
