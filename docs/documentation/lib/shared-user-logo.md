# Shared User Logo

## Source

- `lib/users/sharedUserLogo.ts`

## Responsibility

Server-only helpers for content-addressed user logos: identical pictures share one S3 file at `orders/user-logos/shared/<sha256><ext>`, so the user modal's "Previously used pictures" shows each picture once. Kept out of `profileAppearance.ts` because that module is imported by client components and this one needs Node's `crypto`.

## Functions

| Function | Description |
| --- | --- |
| `hashUserLogoBytes` | SHA-256 hex digest of a logo's bytes. |
| `getSharedUserLogoKey` | Content-addressed S3 key for a logo (extension lower-cased). Used by `POST /api/auth/users/logo`. |
| `planUserLogoDedupe` | Groups existing logo paths by hash and plans moving each group onto its shared path (reusing an existing shared copy when present). Used by `scripts/dedupe-user-logos.ts`. |

## Cleanup script

`npm run dedupe:user-logos` (dry run) / `npm run dedupe:user-logos -- --apply`, add `--prod` to use `.env` only (production) — reads every logo referenced by a `User` or `Invite`, hashes it, copies each duplicate group onto its shared path, repoints users/invites and deletes the old copies. Without `--prod` it loads `.env` then `.env.local` (`scripts/_loadScriptEnv.ts`); it prints the DB host and S3 bucket first.
