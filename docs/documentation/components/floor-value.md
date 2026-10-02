# Floor Values (homepage booking flow)

## Source

- `app/_components/site/BookingModal/whiteGoods/floorValue.ts` (client)
- `app/_components/site/BookingModal/whiteGoods/floorLiftField.tsx` (client)
- `lib/booking/floorNumber.ts` (server)

## Responsibility

Floors count from 1 (the ground floor, "1. etasje") and go negative below ground (-1 is the first basement). There is no floor 0. On the client, `null` means "not chosen yet", which keeps the required field empty. On the server, 0 means "not given".

`FloorLiftField` / `FloorInput` is a text input rather than `type="number"`, so letters, decimals, `e` and `+` can't be typed. It keeps its own text, so a lone `-` survives mid-typing, and re-syncs when the up/down stepper changes the floor. It uses the full keyboard (`inputMode="text"`), not a numeric keypad, because iOS's keypad has no minus key.

## Functions

| Function | Purpose |
|---|---|
| `sanitizeFloorText` | Filters what's typed: digits plus one leading minus, no leading zeros, at most 3 digits. |
| `parseFloorInput` | Text → a whole non-zero floor, or `null` (empty, lone `-`, `0`, non-numbers). |
| `stepFloor` | One stepper step. From `null` it lands on 1, and it skips 0 (1 ↔ -1). |
| `parseFloorNumber` (server) | Reads a submitted floor for `POST /api/site/white-goods-order` and `parseExtraPickupLocations`. It keeps negative floors and falls back to 0 for anything that isn't a whole number. A non-zero floor, basements included, is written to the order notes. |
