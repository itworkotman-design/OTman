# Customer Login

## Source

- `lib/customerAccounts/customerLogin.ts`

## Responsibility

Handles "My order" login and "send me a new password". Both give the same answer for an unknown, expired or wrong account, so neither reveals which emails have orders. Both are rate limited with the DB-backed limiter in `lib/auth/rateLimit.ts`:

| Action | Per email | Per IP | Window |
|---|---|---|---|
| Login (counts failed attempts) | 10 | 30 | 15 min |
| New password (counts every request) | 3 | 10 | 1 hour |

## Functions

| Function | Purpose |
|---|---|
| `loginCustomer` | Checks the email and password, and that the account isn't expired. On success it records `lastLoginAt` and creates a session. |
| `resetCustomerPassword` | For a live account, sets a new generated password and revokes every session. Returns the password and the account's newest order (to log the email on), or `null`. |
