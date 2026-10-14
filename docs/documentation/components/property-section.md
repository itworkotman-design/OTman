# `app/_components/site/BookingModal/moving/PropertySection.tsx`

## Purpose
One end of the move in `MovingRequestFlow` — used for both "Hvor flytter du fra?" and
"Hvor flytter du til?": address (`AddressAutocompleteInput`), property type chips, size tiles
(with prices only when `sizePrice` is given — the origin), `HouseIllustration` + floors stepper,
"Er det heis?" (only for Leilighet/Kontor, `movingLiftApplies`) and "Hvor nær kan vi parkere?".
The next section opens (via `AutoAdvance`, `onReady`/`onRetract`) as soon as `isMovingEndReady` — the address
picked from the suggestions (`addressSelected`; free-typed shows "Velg en adresse fra forslagene" after blur, as in
the delivery modal) and every answer in —
and closes again if an answer is cleared — no Continue button.

## Functions
### `PropertySection(props)`
Controlled: `value`/`onChange` is a `MovingPropertyDraft`.
### `propertySummary(locale, draft, sizeOptions)`
Customer-facing one-liner for the summary step, e.g. `Leilighet, Under 40 m², 1 etasje, heis: ja, parkering: innen 50 m`.
### `floorsLabel(locale, n)`
`1 etasje` / `2 etasjer` (`floor`/`floors`).
