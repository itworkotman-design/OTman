# Order Attachment Download Route

## Source

- `app/api/orders/[orderId]/attachments/[attachmentId]/download/route.ts`

## Responsibility

Serves locally stored order attachment files through an authenticated endpoint. The route checks active-company access to the order, reads the file from local upload storage, and returns download headers with the stored filename, MIME type, and content length.

## Functions

| Function | Description |
| --- | --- |
| `getLocalUploadPath` | Resolves a `/uploads/...` storage path to a safe path inside `public/uploads`. |
| `contentDispositionFilename` | Removes unsafe characters from filenames before they are written into the download header. |
| `GET` | Validates the session and order access, loads attachment metadata, reads the local file, and returns it with `Content-Type`, `Content-Disposition`, and `Content-Length` headers. |

