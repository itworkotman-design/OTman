# Pending Order Attachment Download Route

## Source

- `app/api/orders/pending-attachments/[attachmentId]/download/route.ts`

## Responsibility

Serves pending attachment files through an authenticated session-scoped endpoint. The route redirects S3-backed files to short-lived signed URLs and reads local development uploads without exposing raw storage paths to the browser.

## Functions

| Function | Description |
| --- | --- |
| `getLocalUploadPath` | Resolves a `/uploads/...` storage path to a safe path inside `public/uploads`. |
| `contentDispositionFilename` | Removes unsafe characters from filenames before they are written into the download header. |
| `toArrayBuffer` | Converts downloaded bytes into a response-compatible body. |
| `GET` | Validates the session, loads the pending attachment, redirects S3-backed files to a signed URL, and returns local files with download headers when needed. |
