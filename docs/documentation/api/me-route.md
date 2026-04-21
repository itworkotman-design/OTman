# Me API

## Source

- `app/api/auth/me/route.ts`

## Responsibility

Returns the authenticated user summary, active-tenant state, and selectable memberships used by the dashboard shell and login flow.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Validates the authenticated session, loads selectable memberships, and returns the user identity together with the optional sidebar logo and username display color. |
