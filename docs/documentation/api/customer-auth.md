# Customer auth routes ("My order")

## Source

- `app/api/customer/login/route.ts`
- `app/api/customer/logout/route.ts`
- `app/api/customer/password-reset/route.ts`
- `app/api/customer/password/route.ts`

## Responsibility

Login for temporary customer accounts (see `docs/documentation/lib/customer-accounts.md`). The session cookie is `csid`, separate from the dashboard's `sid`.

| Route | Body | Result |
|---|---|---|
| `POST /api/customer/login` | `{ email, password }` | Logs the customer in and sets `csid`. Returns `401 INVALID_CREDENTIALS` for any wrong, unknown or expired account, and `429 RATE_LIMITED` when rate limited (`customerLogin.ts`). |
| `POST /api/customer/logout` | none | Revokes the session and clears the cookie. |
| `POST /api/customer/password-reset` | `{ email }` | If the email has a live account, sets a new generated password and emails it (`sendCustomerCredentialsEmail`, logged on the account's newest order). Always answers `{ ok: true }`, so it never reveals whether the email has an account. |
| `POST /api/customer/password` | `{ currentPassword, newPassword }` | Needs a session. Replaces the password; the new one must have at least 8 characters. Every other session of the account is logged out. Returns `422 PASSWORD_TOO_SHORT` or `403 INVALID_CURRENT_PASSWORD` on failure. |
