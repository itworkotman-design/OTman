# Catalog seed scripts (`scripts/seed-*-catalog*.ts`)

Two families, deliberately separate so a seed can never hit the wrong database:

| Command | Database | Notes |
|---|---|---|
| `npm run seed:white-goods-catalog` / `seed:furniture-catalog` / `seed:moving-catalog` / `seed:parcel-pallet-catalog` (and `scripts/seed-website-orders.ts`) | **Local only** | `_loadLocalSeedEnv.ts`: `.env`, then `.env.local` overrides; **hard-fails unless `DATABASE_URL` is on localhost**. |
| `npm run seed:white-goods-catalog:prod` / `seed:furniture-catalog:prod` / `seed:moving-catalog:prod` / `seed:parcel-pallet-catalog:prod` | **Production** (`DATABASE_URL` in `.env`) | `_loadProductionSeedEnv.ts`: reads ONLY `.env`, refuses a localhost target, prints a banner and requires typing the database name before the first write. |

- Target detection is `_seedTarget.ts` (host + database name only; credentials are
  never printed). Tested in `_seedTarget.test.ts`.
- Why: the scripts used to `import "dotenv/config"`, which reads only `.env` — the
  cloud DB — so `npm run seed:*` from a dev shell silently wrote to the cloud.
- **Deploy before seeding production.** The production database only gets new
  migrations when the app is deployed (`build.sh` runs `prisma migrate deploy`);
  seeding first fails with e.g. "column pricingMode does not exist".
- Seeds are idempotent upserts. Catalogs whose prices staff enter in
  `/dashboard/booking/editPrices` (Moving, parcel/pallet, and furniture's
  `staffPriced` "Other furniture" size brackets) never have those prices
  overwritten on reseed.
