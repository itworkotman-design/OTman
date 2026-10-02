# Dashboard Order Modal

## Source

- `app/_components/Dahsboard/booking/DashboardOrderModal.tsx`

## Responsibility

A drop-in replacement for `OrderModal` with the same props. It's used where admins open an order: `/dashboard/website-orders`, and the admin view of `/dashboard/booking`.

On open it asks `GET /api/orders/[orderId]/website-details`:
- `ok` → the read-only `WebsiteOrderModal`;
- any other answer → the regular `OrderModal`, unchanged.

While deciding, it shows a small "Loading order…" overlay. It handles the scroll lock and Escape for its own UI; `OrderModal` keeps doing that itself. `OrderModal`, `BookingEditor` and `GET/PATCH /api/orders/[orderId]` are not modified.

After an admin action in the website view (`onChanged`), it re-fetches the order in place and calls `onSaved` so the list behind it refreshes.
