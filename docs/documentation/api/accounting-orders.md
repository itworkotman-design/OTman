# Accounting orders

Source: `app/api/integrations/accounting/orders/route.ts`

`GET /api/integrations/accounting/orders?from=YYYY-MM-DD&to=YYYY-MM-DD[&limit=500][&cursor=…]` — for the OtmanAccounting app (`authenticate-accounting-request.md`). The company's orders delivered from `from` to `to` (inclusive), oldest first, one row per order as the booking export has it (`accounting-order.md`). Every status is returned; the caller decides which count. No customer names, phones or addresses.

Response: `{ ok: true, orders: [...], nextCursor }`. When `nextCursor` isn't null, ask again with `cursor=<nextCursor>` for the next page.

- `GET(request)` — validates the query, reads `limit + 1` orders to know whether another page follows, looks up the price list names in one go, and maps the rows.
  - `400` `INVALID_FROM_DATE` / `INVALID_TO_DATE` (missing or not `YYYY-MM-DD`), `INVALID_DATE_RANGE` (`from` after `to`), `DATE_RANGE_TOO_LONG` (92 days or more), `INVALID_LIMIT` (not 1–1000).
  - `401`/`403`/`503` from authentication; `503 SERVICE_UNAVAILABLE` when the database fails.
