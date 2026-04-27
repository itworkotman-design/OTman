# Login Helper

## Source

- `lib/auth/login.ts`

## Responsibility

Authenticates users with either username or e-mail plus password, applies login rate limits, upgrades valid legacy password hashes to Argon2id, creates the session, and logs auth events.

## Functions

| Function | Description |
| --- | --- |
| `incrementLoginRateLimits` | Increments the login identifier and IP rate-limit buckets after a failed login attempt. |
| `normalizeLoginIdentifier` | Normalizes the submitted login value into either an e-mail identifier or a case-insensitive username identifier. |
| `loginWithIdentifierPassword` | Validates the identifier and password, finds the user by e-mail or username, enforces rate limits and status checks, upgrades legacy password hashes after successful verification, creates the session, and logs success or failure events. |
