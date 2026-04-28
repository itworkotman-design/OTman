# Order Attachments By Order Route

## Source

- `app/api/orders/[orderId]/attachments/route.ts`

## Responsibility

Lists and uploads files attached directly to a saved order. Each file carries an explicit category and returned attachment URLs point at the authenticated app download endpoint instead of raw storage paths or WordPress source URLs.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedAttachmentFile` | Validates whether the uploaded file type is supported. |
| `GET` | Returns all files for a specific order, including category metadata and the app download URL. |
| `POST` | Uploads a new file to a specific order, validates its category, stores it on disk, saves its metadata, and returns the app download URL. |
