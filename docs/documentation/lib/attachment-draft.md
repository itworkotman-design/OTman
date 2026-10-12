# Attachment draft

## Source

- `lib/orders/attachmentDraft.ts`

## Responsibility

An existing order's attachment changes, held in the browser until the order's Save button, so picking or removing a file never changes an order by itself. Used by `BookingEditor` (regular orders) and `WebsiteOrderAttachments` / `WebsiteOrderAdminActions` (website orders). New orders keep using pending uploads (`/api/orders/pending-attachments`), which are linked when the order is created. That pool is per user and swept in whole on create, so it isn't used for edits.

## Functions

| Function | Purpose |
|---|---|
| `EMPTY_ATTACHMENT_DRAFT` | No changes. |
| `hasAttachmentChanges(draft)` | Whether anything was picked or removed. |
| `stageAttachmentUpload(draft, file, category, { id, url })` | Adds a picked file (temporary id, object-URL preview) at the top. Nothing is uploaded. |
| `stageAttachmentRemoval(draft, id)` | Drops a picked file, or marks a saved one for deletion. |
| `visibleAttachments(saved, draft)` | The list after Save: picked files first, saved ones minus the removed. |
| `applyAttachmentDraft(orderId, draft, fetch?)` | Run by Save after the order saved. It uploads the picked files (`POST /api/orders/[orderId]/attachments`), deletes the removed ones (`DELETE /api/orders/attachments/[id]`), and returns `{ ok, failed, remaining }`. `remaining` holds only the changes that failed, so the next Save retries just those without uploading the rest twice. |
