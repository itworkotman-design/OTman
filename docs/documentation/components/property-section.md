# `app/_components/site/BookingModal/moving/PropertySection.tsx`

## Purpose
Each end of the move in `MovingRequestFlow` ("moving from", "moving to") is asked in two sections, so neither
reveals too much at once:
1. `PropertyWhereSection` — address (`AddressAutocompleteInput`, must be picked from the suggestions; free-typed shows
   "Velg en adresse fra forslagene" after blur, as in the delivery modal) and property type chips. Opens the next
   section via `AutoAdvance` once `isMovingEndWhereReady`.
2. `PropertyDetailsSection` — size tiles (no prices — the live calculator shows them), `HouseIllustration` +
   floors stepper; for Leilighet/Kontor (`movingLiftApplies`) "Hvilken etasje?" and "Heis?" side by side in one row (the delivery
   modal's `FloorInput`, `large`, `stepperLeft`, pre-filled with 1, no price beside it; Ja/Nei chips at the same `h-12` (not asked on floor 1 — `movingLiftRequired`: the row animates `grid-template-columns` `1fr 0fr` ⇄ `1fr 1fr`, so the floor box fills the row and the lift column collapses to zero width, faded out and `inert`)
   height — the floor surcharge only applies on "Nei"); and "Hvor nær kan vi parkere?" (no prices on the
   pills — the live calculator shows the carrying-distance surcharge). Opens the next section once `isMovingEndReady`.
Both close the sections after them again (`onRetract`) if an answer is cleared.

## Functions
### `PropertyWhereSection(props)` / `PropertyDetailsSection(props)`
Controlled: `value`/`onChange` is the end's `MovingPropertyDraft`, shared by both sections.
### `floorsLabel(locale, n)`
`1 etasje` / `2 etasjer` (`floor`/`floors`).

Layout of `PropertyDetailsSection`: a `sm:grid-cols-[minmax(0,1fr)_220px]` row — size tiles, then the floor + lift
row on the left, the house preview (vertically centred) filling the right column beside all of them;
parking runs full width below.
