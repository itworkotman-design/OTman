# `app/_components/site/BookingModal/whiteGoods/cardSummaryChips.ts`

## Purpose
Builds the short recap chips shown under a product card's title ("Levering: Ytterdør", "Montering: Ingen", "2 tillegg").

## Functions
### `buildCardSummaryChips({ locale, deliveryType, installLabel, showInstallChip, addonCount })`
`showInstallChip` is false for products with no installation options at all (e.g. pakke/pall catalog items) — the "Montering: Ingen" chip is left out entirely rather than showing for a step that doesn't exist. Callers pass their `hasInstallStepContent` result (see `cardSectionVisibility.ts`).
