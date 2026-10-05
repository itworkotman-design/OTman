# Dashboard Order Modal

## Source

- `app/_components/Dahsboard/booking/DashboardOrderModal.tsx`

## Responsibility

A drop-in replacement for `OrderModal` with the same props. It's used where admins open an order: `/dashboard/website-orders`, and the admin view of `/dashboard/booking`.

On open it asks `GET /api/orders/[orderId]/website-details`, decided by `orderModalMode` (`orderModalMode.ts`):
- `ok` → `WebsiteOrderModal`;
- `NOT_WHITE_GOODS_WEBSITE_ORDER`, `NOT_FOUND` or `FORBIDDEN` → the regular `OrderModal`, unchanged;
- anything else (a server error, a failed request) → an error with "Try again". It never falls back to the regular modal, because a website order opened there would be edited with the wrong pricing.

While deciding, it shows a small "Loading order…" overlay. It handles the scroll lock and Escape for its own UI; `OrderModal` keeps doing that itself. `OrderModal`, `BookingEditor` and `GET/PATCH /api/orders/[orderId]` are not modified.

After an admin action in the website view (`onChanged`), it re-fetches the order in place and calls `onSaved` so the list behind it refreshes.
