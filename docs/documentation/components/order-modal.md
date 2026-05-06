# Order Modal

## Source

- `app/_components/Dahsboard/booking/OrderModal.tsx`

## Responsibility

Loads and edits one order in the admin archive modal, applying the active booking UI locale to modal labels and editor content.

## Functions

| Function | Description |
| --- | --- |
| `OrderModal` | Fetches the selected order, renders `BookingEditor`, saves updates, optionally deletes the order, and forwards the active locale into modal/editor text. |
