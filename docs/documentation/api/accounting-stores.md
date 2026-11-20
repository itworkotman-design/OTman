# Accounting stores

Source: `app/api/integrations/accounting/stores/route.ts`

`GET /api/integrations/accounting/stores` — for the OtmanAccounting app (`authenticate-accounting-request.md`). Lists the company's order-creator accounts (the archive's "Store"): `loadStoreAccounts` (`accounting-company-accounts.md`).

Response: `{ ok: true, stores: [{ id, name, active }] }`. `id` is the membership ID, the stable key the accounting app stores.

- `GET(request)` — `200` list; `401`/`403`/`503` from authentication; `503 SERVICE_UNAVAILABLE` when the database fails.
