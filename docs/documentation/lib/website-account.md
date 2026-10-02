# Website Account

## Source

- `lib/website/websiteAccount.ts`
- `scripts/create-website-account.ts` (`npm run create:website-account`)

## Responsibility

The dedicated account that public website orders and requests are booked under, kept apart from any staff login. Its membership id is what `WEBSITE_MEMBERSHIP_ID` must hold. That variable is read by `app/api/site/white-goods-order`, `moving-request`, `transport-request` and `special-goods-quote`, by `app/api/public/manpower`, and by `scripts/seed-website-orders.ts`.

The account is `website@otman.no`: a `USER` membership in the `otman` company, with no app access by default. A newly created user gets a random password nobody knows. To log in as it, set a password via forgot-password or user management, and grant modules there.

## Functions

| Function | Purpose |
|---|---|
| `ensureWebsiteAccount` | Idempotent. It creates the user and an active membership if missing, and otherwise reuses them without touching the password. A disabled membership is reactivated. Returns the membership id. Takes a minimal `WebsiteAccountDb` slice of the Prisma client so it can be unit-tested with a fake. |

## Script

`npm run create:website-account` runs against `DATABASE_URL` (`.env.local` overrides `.env`). It prints the database host and the `WEBSITE_MEMBERSHIP_ID=…` line to configure. Run it once per database, including production, and set the printed id in that environment.
