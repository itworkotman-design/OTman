# Order Modal

## Source

- `app/_components/Dahsboard/booking/OrderModal.tsx`

## Responsibility

Loads and edits one order in the admin archive modal, applying the active booking UI locale to modal labels and editor content.

## Functions

| Function | Description |
| --- | --- |
| `OrderModal` | Fetches the selected order, renders `BookingEditor`, saves updates, optionally deletes the order, and forwards the active locale into modal/editor text. |

The editor itself (load, save, delete) lives in `OrderEditPanel` (see `order-edit-panel.md`); this modal is only the frame around it. Admin row clicks now open the Alert Center on its "Edit order" tab instead, so this modal is only used for an order that is not in the loaded table yet (e.g. right after "Copy" of a single order).
