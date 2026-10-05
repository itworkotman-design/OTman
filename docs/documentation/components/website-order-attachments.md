# Website Order Attachments

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAttachments.tsx`

## Responsibility

The "Attachments & receipts" card in `WebsiteOrderModal`. It uses the same `OrderAttachmentsSection` and endpoints as the regular order editor:

- `GET` / `POST /api/orders/[orderId]/attachments` to load and upload;
- `DELETE /api/orders/attachments/[attachmentId]` to delete, after a confirm.

Uploads and deletes take effect immediately; there is no form to save.
