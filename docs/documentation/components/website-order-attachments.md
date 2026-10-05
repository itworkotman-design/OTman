# Website Order Attachments

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAttachments.tsx`

## Responsibility

The "Attachments" card in `WebsiteOrderModal`, under "Handle order". It offers attachments only (`categories={["ATTACHMENT"]}`); receipts belong to the regular booking flow. It uses the same `OrderAttachmentsSection` and endpoints as the regular order editor:

- `GET` / `POST /api/orders/[orderId]/attachments` to load and upload;
- `DELETE /api/orders/attachments/[attachmentId]` to delete, after a confirm.

Uploads and deletes take effect immediately; there is no form to save.
