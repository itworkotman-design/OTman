# lib/dbConnectionString.ts

`pgConnectionString(url)` rewrites `sslmode=require`, `prefer` or `verify-ca` in a database URL to `sslmode=verify-full` before the URL reaches a `pg` pool (`lib/db.ts`, `lib/docArchive/client.ts`).

- **Why:** `pg` already treats those modes as `verify-full` and logs a SECURITY WARNING on every new connection saying so. Spelling the mode out keeps the same behaviour without the warning.
- **Left alone:** URLs with any other mode, with no `sslmode`, or with `uselibpqcompat=true`.
- **Env vars unchanged:** `prisma migrate` reads the same URLs.
