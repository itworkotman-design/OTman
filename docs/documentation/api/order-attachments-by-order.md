# Order Attachments By Order Route

## Source

- `app/api/orders/[orderId]/attachments/route.ts`

## Responsibility

Lists and uploads files attached directly to a saved order. Each file now carries an explicit category.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedAttachmentFile` | Validates whether the uploaded file type is supported. |
| `GET` | Returns all files for a specific order, including category metadata. |
| `POST` | Uploads a new file to a specific order, validates its category, stores it on disk, and saves its metadata. |
