# `app/_components/site/BookingModal/moving/PropertySection.tsx`

## Purpose
Each end of the move in `MovingRequestFlow` ("moving from", "moving to") is asked in two sections, so neither
reveals too much at once:
1. `PropertyWhereSection` — address (`AddressAutocompleteInput`, must be picked from the suggestions; free-typed shows
   "Velg en adresse fra forslagene" after blur, as in the delivery modal) and property type chips. Opens the next
   section via `AutoAdvance` once `isMovingEndWhereReady`.
2. `PropertyDetailsSection` — size tiles (prices only when `sizePrice` is given — the origin), `HouseIllustration` +
   floors stepper; for Leilighet/Kontor (`movingLiftApplies`) "Hvilken etasje ligger den i?" first (the delivery
   modal's `FloorInput`, `large`, fixed width with a live `+N kr` surcharge pill beside it), then "Er det heis?" once a
   floor is entered (the surcharge only applies on "Nei"); and "Hvor nær kan vi parkere?", each pill showing its
   carrying-distance surcharge (`parkingPriceLabel`). Opens the next section once `isMovingEndReady`.
Both close the sections after them again (`onRetract`) if an answer is cleared.

## Functions
### `PropertyWhereSection(props)` / `PropertyDetailsSection(props)`
Controlled: `value`/`onChange` is the end's `MovingPropertyDraft`, shared by both sections.
### `propertySummary(locale, draft, sizeOptions)`
Customer-facing one-liner for the summary step, e.g. `Leilighet, Under 40 m², 1 etasje, heis: ja, parkering: innen 50 m`.
### `floorsLabel(locale, n)`
`1 etasje` / `2 etasjer` (`floor`/`floors`).
