# `lib/booking/pricing/sizeDimensions.ts`

Volume for size-priced products (website furniture **Other furniture**) is
**calculated**, not picked: the customer chooses width, height and length from
preset centimetre choices and the volume (m³) is derived; that volume selects one
of the volume brackets (`sizeBrackets.ts`), so the pricing engines only ever see
a bracket id.

## Exports
- `SIZE_DIMENSION_CHOICES_CM` — the preset choices for each of W/H/L (20, 40, 50,
  60, 80, 100, 120, 150, 200, 250). **Placeholders** (business content); a value
  outside the list is rejected server-side.
- `VOLUME_BRACKET_MAX_M3` — the largest volume each bracket covers, keyed by
  option code (0.25 / 0.5 / 1 / 2 / 4 m³). This table lives **in code**: staff
  edit bracket *prices*, but moving where a bracket ends is a code change. The
  bracket options/labels in `otherFurnitureSizeOptions.ts` are generated from it.
  Larger than the top bracket = not bookable online (manual quote).
- `isAllowedDimensionCm`, `isCompleteDimensions`, `calculateVolumeM3`
  (cm³ / 1,000,000), `findVolumeBracketOptionId(product, m3)` (smallest bracket it
  fits; equal to a limit fits that bracket).
- `applyDimensionDerivedVolumeBrackets(cards, products)` — for each card of a
  product with volume brackets, drops any volume bracket the client sent and adds
  the one implied by `card.sizeDimensionsCm` (none if dimensions are
  missing / not a preset / too big). **Never trust a client-sent volume bracket**
  — a small bracket with big dimensions would dodge the charge. Used by
  `app/api/site/white-goods-order` and `app/api/public/orders/[token]/edit-items`,
  which then require a volume + weight bracket (422 otherwise).

The chosen dimensions are stored on the card (`sizeDimensionsCm`, possibly
partial while the customer is still choosing) and listed in the order's services
summary ("100 × 50 × 50 cm (0.25 m³)") for staff and drivers.
