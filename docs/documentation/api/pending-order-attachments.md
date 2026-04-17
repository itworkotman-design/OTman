# Pending Order Attachments Route

## Source

- `app/api/orders/pending-attachments/route.ts`

## Responsibility

Handles temporary file uploads before an order is created. Files are stored per user session and now keep an explicit category such as attachment or receipt.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedAttachmentFile` | Validates whether the uploaded file type is supported. |
| `GET` | Returns the current session's pending files, including their category. |
| `POST` | Uploads a new pending file, validates its category, stores it on disk, and saves its metadata in the database. |
| `DELETE` | Clears all pending files for the current session and removes the stored files from disk. |
