# Request IP

## Source

- `lib/customerAccounts/requestIp.ts`

## Responsibility

`getClientIp(req)` returns the first `x-forwarded-for` hop. The customer login and password-reset routes use it for rate limiting, the same way `app/api/auth/login` does.
