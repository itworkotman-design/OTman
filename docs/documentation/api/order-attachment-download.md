# Order Attachment Download Route

## Source

- `app/api/orders/[orderId]/attachments/[attachmentId]/download/route.ts`

## Responsibility

Serves order attachment files through an authenticated endpoint. The route checks active-company access to the order, redirects S3-backed files to short-lived signed URLs, reads local upload storage when needed, and falls back to the stored WordPress source URL when an imported local copy is missing.

## Functions

| Function | Description |
| --- | --- |
| `getLocalUploadPath` | Resolves a `/uploads/...` storage path to a safe path inside `public/uploads`. |
| `contentDispositionFilename` | Removes unsafe characters from filenames before they are written into the download header. |
| `toArrayBuffer` | Converts downloaded S3 bytes into a response-compatible body. |
| `getRemoteAttachmentUrl` | Validates that a stored source URL is an HTTP(S) URL before it can be used as a fallback. |
| `downloadRemoteAttachment` | Downloads a missing imported attachment from its stored source URL and returns its bytes, MIME type, and size. |
| `GET` | Validates the session and order access, redirects S3-backed files to a signed URL, returns local files directly, and falls back to the stored remote source URL for missing WordPress-imported files. |
