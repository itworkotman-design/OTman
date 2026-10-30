# useResolvedOrder

## Source

- `app/_components/Dahsboard/booking/useResolvedOrder.ts`

## Responsibility

A hook that asks `GET /api/orders/[orderId]/website-details` whether an order is a homepage website order (decided by `orderModalMode`), and loads it if so. Returns `current` (`{ mode: "website", order }`, `{ mode: "standard" }` or `{ mode: "error" }`; `null` while loading), `reload()` (re-fetch while the current view stays up) and `retry()` (back to loading). Used by `DashboardOrderModal` and `WebsiteOrderEditPanel`.
