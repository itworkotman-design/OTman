# `app/api/orders/[orderId]/moving-details/route.ts`

## Purpose
`PUT` — the admin's edit of a homepage move (WebsiteOrderModal, `websiteOrderKind: "MOVING"`). Owner/admin or Website orders
at ADMIN level. Tested.

- `edit` (a `MovingEdit`) — re-priced from the moving catalog (`priceMovingOrder`), the distance looked up again only when an
  address moved; lines replaced (`movingOrderSaveWrites`). Refused (409) on cancelled/completed/invoiced/paid orders.
- `customer`, `preferredDate`, `timeWindow` — contact details and schedule.
- `handling` — the "Handle order" panel's fields that don't change a move's price (drivers, driver info, plate, internal
  description, date, time window). Express, deviation and the calculator fields are white-goods prices: dropped, never stored.
- `dryRun` — returns the price and the paid-vs-now `comparison` without saving.
Status and partner save through `/api/orders/bulk`. Changes are logged on the order's history.
