# Invite Create API

## Source

- `app/api/auth/invites/create/route.ts`

## Responsibility

Receives dashboard invite requests, normalizes the request body, and delegates invite creation and delivery to the auth helpers.

## Functions

| Function | Description |
| --- | --- |
| `getClientIp` | Reads the first forwarded IP address from the request headers when present. |
| `parsePermissions` | Filters request permission values down to the supported booking permissions. |
| `POST` | Validates session and tenant context, forwards the invite payload to the invite helper, and now includes the optional profile address in the invite seed data. |
