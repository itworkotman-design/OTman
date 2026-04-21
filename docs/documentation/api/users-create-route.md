# User Create API

## Source

- `app/api/auth/users/create/route.ts`

## Responsibility

Receives dashboard requests to create a user immediately with an owner-entered password, validates session and tenant context, and delegates the user creation to the auth helper.

## Functions

| Function | Description |
| --- | --- |
| `parsePermissions` | Filters request permission values down to the supported booking permissions. |
| `POST` | Validates session and tenant context, rejects mismatched passwords, forwards the direct-create payload including optional sidebar appearance fields to the auth helper, and maps conflict and permission errors to HTTP responses. |
