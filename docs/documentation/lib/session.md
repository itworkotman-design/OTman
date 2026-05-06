# Session Helpers

## Source

- `lib/auth/session.ts`

## Responsibility

Manages session cookies, resolves authenticated sessions from the database, and exposes the session user profile and language fields needed by authenticated routes.

## Functions

| Function | Description |
| --- | --- |
| `setSessionCookie` | Writes the session cookie for a successful login or invite acceptance. |
| `clearSessionCookie` | Clears the session cookie. |
| `parseCookie` | Extracts a named cookie value from the raw request header. |
| `sha256Hex` | Hashes a session token into the stored token hash format. |
| `getAuthenticatedSession` | Resolves the active session and returns the current user identity, active tenant metadata, sidebar appearance fields, and language preference. |
| `revokeAllUserSessions` | Revokes every active session for a user. |
