# Order Modal

## Source

- `app/_components/Dahsboard/booking/OrderModal.tsx`

## Responsibility

Loads and edits one order in the admin archive modal, applying the active booking UI locale to modal labels and editor content.

## Functions

| Function | Description |
| --- | --- |
| `OrderModal` | Fetches the selected order, renders `BookingEditor`, saves updates, optionally deletes the order, and forwards the active locale into modal/editor text. |
| `handleSave` | `BookingEditor`'s `onSubmit`: only `PATCH /api/orders/[orderId]`. It doesn't close the modal, because the editor still uploads and deletes the attachment changes. |
| `handleAfterSave` | `BookingEditor`'s `onAfterSave`, called once the whole Save finished (order + attachments). It reloads the list (`onSaved`) and closes only when every file change went through (`attachmentsSaved`). Otherwise the modal stays open with the editor's error, and Save retries just the failed files. |
