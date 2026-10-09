# `app/api/auth/heartbeat/route.ts`

## Purpose
`POST` polled by dashboard order lists to find out whether orders were created or changed since `lastChecked`.

## Functions
### `POST(req)`
Body: `{ lastChecked: ISO string, websiteOrdersOnly?: boolean }`. Counts the active company's orders created after `lastChecked` and those updated after it (but created before it), and returns `{ ok, now, hasNewOrders, hasChangedOrders }`. With `websiteOrdersOnly: true` both counts are limited to `isWebsiteOrder` orders; the Website orders page uses this.
