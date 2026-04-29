# Order Attachments By Order Route

## Source

- `app/api/orders/[orderId]/attachments/route.ts`

## Responsibility

Lists and uploads files attached directly to a saved order. Each file carries an explicit category and returns separate open and download URLs. S3-backed files use short-lived signed URLs for open/preview access, while downloads stay on the authenticated app route. Uploads use S3 when attachment storage environment variables are configured, with local disk storage kept as the development fallback.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedAttachmentFile` | Validates whether the uploaded file type is supported. |
| `GET` | Returns all files for a specific order, including category metadata plus open and download URLs. |
| `POST` | Uploads a new file to a specific order, validates its category, stores it in S3 or local disk storage, saves its metadata, and returns open and download URLs. |
