# Login API

## Source

- `app/api/auth/login/route.ts`

## Responsibility

Receives login requests, normalizes either an `identifier` or legacy `email` payload field, delegates authentication to the auth helper, and sets the session cookie on success.

## Functions

| Function | Description |
| --- | --- |
| `getClientIp` | Reads the first forwarded IP address from the request headers when present. |
| `POST` | Parses the login payload, accepts either username or e-mail identifiers, forwards the request to the login helper, and returns the correct auth response and cookie. |
