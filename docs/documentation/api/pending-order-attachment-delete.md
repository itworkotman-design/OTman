# Pending Order Attachment Delete Route

## Source

- `app/api/orders/pending-attachments/[attachmentId]/route.ts`

## Responsibility

Deletes one pending attachment for the current session. The route removes the database record and then removes the stored S3 object or local upload file.

## Functions

| Function | Description |
| --- | --- |
| `DELETE` | Validates the session, deletes the pending attachment record, and removes the backing S3 object or local file when present. |
