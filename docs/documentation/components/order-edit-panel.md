# `app/_components/Dahsboard/booking/OrderEditPanel.tsx`

The admin order editor without any modal frame: it loads `GET /api/orders/[id]`, renders `BookingEditor`, saves with `PATCH`, and optionally deletes with `DELETE` (with a confirm).

| Prop | Description |
| --- | --- |
| `orderId` | Order to edit. It is reloaded when this changes. |
| `locale` | Booking UI locale. |
| `canDelete` | Shows the "Delete order" button. |
| `onSaved` / `onDeleted` | Called after a successful save or delete (the parent reloads its list). |
| `onDone` | Called after a successful save or delete, so the parent can close its modal. |
| `onLoaded` | Receives the loaded order (`OrderModal` uses `displayId` for its title). |

Used by the Alert Center's "Edit order" tab (`OrderEmailModal`) and by `OrderModal`.
