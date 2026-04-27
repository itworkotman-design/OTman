# Password Helper

## Source

- `lib/auth/password.ts`

## Responsibility

Hashes app passwords with Argon2id, verifies app password hashes, and verifies imported WordPress password hashes for lazy migration.

## Functions

| Function | Description |
| --- | --- |
| `hashPassword` | Creates a new Argon2id password hash for app-managed passwords. |
| `timingSafeEqualString` | Compares same-length strings without early-exit timing leaks. |
| `encodePhpass64` | Encodes MD5 bytes with the phpass portable hash alphabet. |
| `verifyWordpressPhpass` | Verifies legacy WordPress `$P$` phpass password hashes. |
| `verifyWordpressBcrypt` | Verifies WordPress bcrypt hashes, including current `$wp` prefixed hashes. |
| `verifyWordpressPassword` | Routes WordPress MD5, phpass, and bcrypt hash verification by hash prefix. |
| `verifyPasswordWithMetadata` | Verifies a password and reports whether the stored hash should be upgraded. |
| `verifyPassword` | Returns a boolean password verification result for callers that do not need migration metadata. |
