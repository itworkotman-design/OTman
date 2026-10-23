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
- **Option codes were shortened** (`lib/content/shortCatalogCode.ts`). Reseeding renames existing options in place, so ids, prices and orders are kept. Until a catalog is reseeded, its old codes still work.
- Seeds are idempotent upserts. Catalogs whose prices staff enter in
  `/dashboard/booking/editPrices` (Moving, parcel/pallet, and furniture's
  `staffPriced` "Other furniture" size brackets) never have those prices
  overwritten on reseed.

## `scripts/convert-website-orders-to-ex-vat.ts`

One-time data conversion for the switch to ex-VAT website prices (`lib/orders/websiteOrderExVatConversion.ts`). It is a dry run by default and prints the target database host and each order's before/after. It writes only with `--apply`. For every order it checks that the amount the customer is charged stays exactly the same, and refuses that order otherwise. Already-converted orders are skipped, so it is safe to run twice. It must run together with the deploy of the ex-VAT code: until an old order is converted, its stored incl.-VAT snapshot would be charged 25% on top.

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx --tsconfig tsconfig.json scripts/convert-website-orders-to-ex-vat.ts           # dry run
DOTENV_CONFIG_PATH=.env.local npx tsx --tsconfig tsconfig.json scripts/convert-website-orders-to-ex-vat.ts --apply   # write
```

## `scripts/clean-website-prices.ts`

One-time price cleanup so every homepage price a private customer sees (ex. VAT + 25%) ends in 0. Every customer price on the `WEBSITE_*` price lists is raised to the next multiple of 8 kr ex. VAT (`lib/booking/pricing/websiteCleanPrice.ts`), e.g. 260 (325 incl.) → 264 (330 incl.). It covers option prices, special options, the order-level fees and deviation fees in the list settings, and each product's delivery-type prices. Installation only is lowered instead (609 → 608) so it stays under doorstep delivery. Partner prices and the per-km rates are left alone. It also leaves alone, and lists, weight/size-priced options, options with an active discount, and products also priced on a non-website list. It is a dry run by default and writes only with `--apply`, all in one transaction. Already-clean prices are untouched, so it is safe to run twice. Existing orders keep their frozen prices. The seeds produce the same numbers (`websiteSeedCustomerPrice`), so a reseed doesn't undo it.

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx --tsconfig tsconfig.json scripts/clean-website-prices.ts           # dry run
DOTENV_CONFIG_PATH=.env.local npx tsx --tsconfig tsconfig.json scripts/clean-website-prices.ts --apply   # write
```
