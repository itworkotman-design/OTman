# `lib/content/otherFurnitureSizeOptions.ts`

The volume and weight bracket options for `FN_OTHER_FURNITURE`, merged into
`FURNITURE_PRODUCTS` by `furnitureCatalog.ts` (kept out of the generated
`furnitureCatalogData.ts`, which regeneration would overwrite).

- 5 volume brackets `OF_VOL_1..5` — **generated from `VOLUME_BRACKET_MAX_M3`**
  (`sizeDimensions.ts`; up to 0.25 / 0.5 / 1 / 2 / 4 m³) and not picked by the
  customer: the volume is calculated from their width/height/length. 5 weight
  brackets `OF_WT_1..5` (up to 25 / 50 / 100 / 200 / 400 kg), picked directly.
- **The boundaries are placeholders** and every price is **0 kr**: staff set the
  real labels/prices in `/dashboard/booking/editPrices` before launch. Items
  larger than the top bracket have no bracket, so aren't bookable online.
- `staffPriced: true` → `seedWebsiteCatalog` creates the option with the
  placeholder price but never overwrites an existing price on reseed (furniture
  otherwise refreshes prices from the spreadsheet data every reseed).
- Create them with `npm run seed:furniture-catalog` (local) and, after deploying,
  `npm run seed:furniture-catalog:prod` (production) — see
  `docs/documentation/scripts/seed-scripts.md`.
- The flat delivery prices (first step 608.88 / indoor 690.41) are unchanged;
  the size charge is added on top. The separate "Assembly — needs
  implementation" note for this product is untouched.
