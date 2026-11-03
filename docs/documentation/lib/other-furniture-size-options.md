# `lib/content/otherFurnitureSizeOptions.ts`

The size options for `FN_OTHER_FURNITURE` ("Andre møbler"), merged into
`FURNITURE_PRODUCTS` by `furnitureCatalog.ts` (kept out of the generated
`furnitureCatalogData.ts`, which regeneration would overwrite).

- 2 volume brackets `OF_VOL_SM` (up to 1.5 m³) and `OF_VOL_LG` (up to 4 m³) —
  **generated from `VOLUME_BRACKET_MAX_M3`** (`sizeDimensions.ts`) and not picked
  by the customer: the volume is calculated from their width/height/length.
  2 weight brackets `OF_WT_SM` (up to 50 kg) and `OF_WT_LG` (over 50 kg), picked
  directly.
- The small brackets are `LIGHT`, the large ones `HEAVY` (`weightClass`). Over
  either limit the item is delivered as a large item — see
  [website-size-tier.md](website-size-tier.md).
- 2 large-item delivery prices `OF_LG_FIRST_STEP` / `OF_LG_INDOOR` (category
  `size_large_delivery`), seeded from the side-by-side fridge's delivery prices.
  The product's own delivery prices (the oven's) are the small item's.
- The brackets are **0 kr**. A price staff give one is still added on top
  (`sizeBrackets.ts`), and shown in the picker.
- Everything here is `staffPriced: true`: `seedWebsiteCatalog` creates it with
  the seed's price but never overwrites an existing price on reseed.
- Items larger than 4 m³ have no volume bracket, so aren't bookable online.
- The old five-step brackets (`OF_VOL_1..5`, `OF_WT_1..5`) are deactivated by the
  furniture seed (`retireMissingOptionsWithPrefix` `"OF_"`); saved orders keep
  their lines.
- Create them with `npm run seed:furniture-catalog` (local) and, after deploying,
  `npm run seed:furniture-catalog:prod` (production) — see
  `docs/documentation/scripts/seed-scripts.md`.
