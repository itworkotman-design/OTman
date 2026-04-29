# Pending Order Attachments Route

## Source

- `app/api/orders/pending-attachments/route.ts`

## Responsibility

Handles temporary file uploads before an order is created. Files are stored per user session in S3 when attachment storage environment variables are configured, or on local disk in development. Each file keeps an explicit category such as attachment or receipt, and returned responses include separate open and download URLs.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedAttachmentFile` | Validates whether the uploaded file type is supported. |
| `GET` | Returns the current session's pending files, including their category plus open and download URLs. |
| `POST` | Uploads a new pending file, validates its category, stores it in S3 or local disk storage, saves its metadata, and returns open and download URLs. |
| `DELETE` | Clears all pending files for the current session and removes stored S3 objects or local files. |
