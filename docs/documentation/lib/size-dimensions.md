# `lib/booking/pricing/sizeDimensions.ts`

Volume for size-priced products (website furniture **Other furniture**) is
**calculated**, not picked: the customer sets width, height and length (whole
centimetres in 5 cm steps, 5–300 — dragged on a ruler or typed in, `DimensionRuler.tsx`) and
the volume (m³) is derived; that volume selects one
of the volume brackets (`sizeBrackets.ts`), so the pricing engines only ever see
a bracket id.

## Exports
- `SIZE_DIMENSION_MIN_CM` / `SIZE_DIMENSION_MAX_CM` / `SIZE_DIMENSION_STEP_CM` (5 / 300 / 5) — the range and step for
  each of W/H/L; anything else (between steps, or a fraction) is rejected server-side.
- `SIZE_DIMENSION_SCALE_MARKS_CM` — the faint marks behind the ruler (50 … 300).
- `parseTypedDimensionCm(text)` — what the customer typed in a dimension's box
  ("120", "85 cm", "12,6") rounded to the nearest 5 cm and clamped to the range; null without a
  number.
- `VOLUME_BRACKET_MAX_M3` — the largest volume each bracket covers, keyed by
  option code: `OF_VOL_SM` 1.5 m³ (a small item) and `OF_VOL_LG` 4 m³ (a large one —
  see `website-size-tier.md`). This table lives **in code**: staff
  edit bracket *prices*, but moving where a bracket ends is a code change. The
  bracket options/labels in `otherFurnitureSizeOptions.ts` are generated from it.
  Larger than the top bracket = not bookable online (manual quote).
- `getVolumeBracketLimitsM3(product)` — the product's active volume bracket
  limits, smallest first (`[1.5, 4]`): the picker's volume meter marks where a
  small item ends and fills up to the last (the most bookable online).
- `isAllowedDimensionCm` (a 5 cm step in range), `isCompleteDimensions`, `calculateVolumeM3`
  (cm³ / 1,000,000), `findVolumeBracketOptionId(product, m3)` (smallest bracket it
  fits; equal to a limit fits that bracket).
- `applyDimensionDerivedVolumeBrackets(cards, products)` — for each card of a
  product with volume brackets, drops any volume bracket the client sent and adds
  the one implied by `card.sizeDimensionsCm` (none if dimensions are
  missing / out of range / too big). **Never trust a client-sent volume bracket**
  — a small bracket with big dimensions would dodge the charge. Used by
  `app/api/site/white-goods-order` and the "My order" edit (`app/api/customer/orders/[orderNumber]`),
  which then require a volume + weight bracket (422 otherwise).

The chosen dimensions are stored on the card (`sizeDimensionsCm`, possibly
partial while the customer is still choosing) and listed in the order's services
summary ("100 × 50 × 50 cm (0.25 m³)") for staff and drivers.
