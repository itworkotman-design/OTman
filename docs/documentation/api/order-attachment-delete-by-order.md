# Order Attachment Delete By Order Route

## Source

- `app/api/orders/[orderId]/attachments/[attachmentId]/route.ts`

## Responsibility

Deletes an order attachment from the order-scoped attachment URL after active-company and edit-permission checks. The route removes the database record and then removes the stored S3 object or local upload file.

## Functions

| Function | Description |
| --- | --- |
| `DELETE` | Validates edit access, deletes the order attachment record, and removes the backing S3 object or local file when present. |
