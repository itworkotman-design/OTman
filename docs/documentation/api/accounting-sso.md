# Accounting sign-in

Source: `app/api/integrations/accounting/sso/route.ts`

`GET /api/integrations/accounting/sso` — the sidebar's "Accounting" link (and the accounting app's "Sign in with Otman" button). Signs the logged-in person into the OtmanAccounting app.

- `GET(request)` — needs an Otman session (else `303` to `/login`), the active company to be the one the accounting app keeps the books for (`OTMAN_API_COMPANY_ID`), an active membership there with the `ACCOUNTING` app access enabled (else `403 NO_ACCOUNTING_ACCESS`), and `ACCOUNTING_SSO_PRIVATE_KEY` + `ACCOUNTING_APP_URL` (else `503 SSO_NOT_CONFIGURED`). Then `303` to `ACCOUNTING_APP_URL/sso?ticket=…` (`accounting-sso-ticket.md`), `cache-control: no-store`.

The `ACCOUNTING` module (`lib/users/appAccessDefaults.ts`) is off by default for everyone, owners included, and like User management only an owner can grant or remove it (`isAppAccessGrantAllowedForNonOwner`). It's set per person in Users → Edit user → Access.
