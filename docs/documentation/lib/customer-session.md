# Customer Session

## Source

- `lib/customerAccounts/customerSession.ts`

## Responsibility

The "My order" login session. It mirrors `lib/auth/session.ts` but is entirely separate from the dashboard's `sid` cookie and `Session` table.

- **Token:** a random token in the `csid` cookie (httpOnly, `sameSite=lax`, secure in production).
- **Storage:** hashed, in `CustomerSession`. A session is valid for 7 days.
- **Expired accounts:** a session belonging to an account past its delete time is treated as gone.

## Functions

| Function | Purpose |
|---|---|
| `createCustomerSession` | Creates a session and returns `{ token, expiresAt }`. |
| `getCustomerSession` | Returns the session from a request's cookie, or `null`. |
| `getCustomerSessionFromToken` | Same, from a raw token (used by server pages). |
| `setCustomerSessionCookie` / `clearCustomerSessionCookie` | Set or clear the cookie on a `NextResponse`. |
| `revokeCustomerSession` | Logs out one session. |
| `revokeCustomerSessions` | Logs out every session of an account, optionally keeping one. |
