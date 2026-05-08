# Gmail Refresh Token

## Source

- `scripts/generate-gmail-refresh-token.ts`

## Responsibility

Provides a local-only helper for generating a Gmail OAuth refresh token. The script prints the token only and does not write it to disk.

## Steps

1. Run `npm run gmail:token`.
2. Log in as `itworkotman@gmail.com`.
3. Paste the returned authorization code into the terminal.
4. Copy the printed `refresh_token` into `GOOGLE_REFRESH_TOKEN`.
5. Restart the dev server.

## Functions

This script does not define reusable functions.
