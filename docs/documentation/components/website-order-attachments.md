# Website Order Attachments

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAttachments.tsx`

## Responsibility

The "Attachments" card in `WebsiteOrderModal`, under "Handle order". It offers attachments only (`categories={["ATTACHMENT"]}`); receipts belong to the regular booking flow. It uses the same `OrderAttachmentsSection` and endpoints as the regular order editor:

- `GET /api/orders/[orderId]/attachments` to load the saved files.

Picking or removing a file changes nothing on the order. The changes are an `AttachmentDraft` (`lib/orders/attachmentDraft.ts`) held by `WebsiteOrderModal` (`draft` / `onDraftChange`). The list shows the saved files with the draft laid over them (`visibleAttachments`), plus a note that file changes are stored on Save. The Overview's Save (`WebsiteOrderAdminActions`) uploads and deletes them (`applyAttachmentDraft`). After that Save, the modal clears the draft and remounts this card (`key`), so it reloads what was stored.
