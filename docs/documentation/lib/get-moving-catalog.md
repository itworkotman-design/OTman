# `lib/content/getMovingCatalog.ts`

## Purpose
Server-side query for the Moving flow's size-bracket options + live prices
(`WEBSITE_MOVING` price list). Shared by
`app/api/site/moving-request/catalog/route.ts` (the public price the
customer sees while picking a size) and `app/api/site/moving-request/route.ts`
(re-resolving that same price server-side on submit, rather than trusting a
client-sent value) — one query, one source of truth for both.

## Functions
- `getMovingCatalog()` — `{ priceListId, options, services, floorSurcharge, carrySurcharges, distanceRates }` or `null` if the
  `WEBSITE_MOVING` price list hasn't been seeded yet
  (`npm run seed:moving-catalog`). Options are active-only, sorted by
  `sortOrder`. Options on the `MOVING_SERVICES_PRODUCT_CODE` product go to
  `services`, the `MOVING_FLOOR_SURCHARGE_PRODUCT_CODE` option to `floorSurcharge`, the `MOVING_CARRY_SURCHARGE_PRODUCT_CODE` options to `carrySurcharges` (null when not seeded —
  then nothing is charged), everything else to `options` (sizes).
- `findMovingSizeOption(options, code)` — looks up one option by code from
  that list; `null` for an unknown/missing code.
- `findMovingServiceOptions(services, codes)` — resolves submitted
  `serviceCodes` in catalog order; missing → `[]`, anything but a list of
  distinct known codes → `null` (route answers 422 `errors.serviceCodes`).

`distanceRates` (`{ kmFrom21, kmOver100 }`, øre per km) come from the moving price list's own settings
(`parsePriceListSettings(priceList.description)`) — the KM_FROM_21/KM_OVER_100 settings every price list has,
edited in `/dashboard/booking/editPrices`. 0 kr when no settings are saved (no km charge).
