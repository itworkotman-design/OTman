# Server Customer Session

## Source

- `lib/customerAccounts/serverCustomerSession.ts`

## Responsibility

"My order" session helpers for server components (the `min-bestilling` pages).

## Functions

| Function | Purpose |
|---|---|
| `getServerCustomerSession` | Returns the session from the `csid` cookie, read via `next/headers`. |
| `safeMyOrderPath` | Returns the login page's `next` target only if it stays inside `/{locale}/min-bestilling`. Otherwise it returns the My order start page, so the login page can't be used as an open redirect. |
