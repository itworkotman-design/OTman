# Accounting order by booking number

Source: `app/api/integrations/accounting/orders/[displayId]/route.ts`

`GET /api/integrations/accounting/orders/{displayId}` — for the OtmanAccounting app (`authenticate-accounting-request.md`), which links orders to insurance cases: the incident order and the follow-up orders booked on the "Otman sak profil" store.

Response: `{ ok: true, order }` — the accounting row (`accounting-order.md`) plus `customerName` (the order's customer name, or null) and `storeReference` (the order's `orderNumber`, the store's own reference, or null). No phone, email or address. Exact lookup on `(companyId, displayId)`.

- `parseDisplayId(value)` — a positive safe integer, else null.
- `GET(request, { params })` — `200` order; `400 INVALID_BOOKING_NUMBER`; `404 ORDER_NOT_FOUND`; `401`/`403`/`503` from authentication; `503 SERVICE_UNAVAILABLE` when the database fails.
