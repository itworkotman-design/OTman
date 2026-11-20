# Accounting partners

Source: `app/api/integrations/accounting/partners/route.ts`

`GET /api/integrations/accounting/partners` — for the OtmanAccounting app (`authenticate-accounting-request.md`). Lists the company's partner (subcontractor) accounts: `loadPartnerAccounts` (`accounting-company-accounts.md`).

Response: `{ ok: true, partners: [{ id, name, active }] }`. `id` is the membership ID, the stable key the accounting app stores.

- `GET(request)` — `200` list; `401`/`403`/`503` from authentication; `503 SERVICE_UNAVAILABLE` when the database fails.
