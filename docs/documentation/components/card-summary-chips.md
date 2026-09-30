# `app/_components/site/BookingModal/whiteGoods/cardSummaryChips.ts`

## Purpose
Builds the short recap chips shown under a product card's title ("Levering: Ytterdør", "Montering: Ingen", "2 tillegg").

## Functions
### `buildCardSummaryChips({ locale, deliveryType, installLabel, showInstallChip, addonCount, sizeInfo })`
`showInstallChip` is false for products with no installation options at all (e.g. pakke/pall catalog items) — the "Montering: Ingen" chip is left out entirely rather than showing for a step that doesn't exist. Callers pass their `hasInstallStepContent` result (see `cardSectionVisibility.ts`).

`sizeInfo` (optional, `WhiteGoodsProductSeed.sizeInfo`) is a product's static max-weight/dimensions spec — parcel/pallet catalog items only (e.g. "Opptil 15 kg · 20×30×40 cm" for the bag). When present it's rendered by `formatSizeInfoChip` and always leads the chip list, since it describes the product itself rather than a selection.

### `formatSizeInfoChip(locale, sizeInfo)`
Formats a `{ maxWeightKg, dimensionsCm? }` spec into one string ("Opptil 100 kg" without dimensions, "Opptil 15 kg · 20×30×40 cm" with). Returns `null` for `sizeInfo: null`.

Also reused (independently of `buildCardSummaryChips`) by `WhiteGoodsProductGrid.tsx`'s local `SizeInfoBadge` — the small "i" badge next to a product tile's name in the "Choose products" step, which reveals this same spec text in a hover/focus tooltip bubble.
