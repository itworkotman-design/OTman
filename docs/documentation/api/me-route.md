# Me API

## Source

- `app/api/auth/me/route.ts`

## Responsibility

Returns the authenticated user summary, saved dashboard language, active-tenant state, and selectable memberships used by the dashboard shell and login flow.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Validates the authenticated session, loads selectable memberships, and returns the user identity together with optional sidebar logo, username display color, and language preference. |
