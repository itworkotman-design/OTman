# `lib/orders/movingProperty.ts`

## Purpose
One end of a move (origin or destination): property type, size bracket, floors, lift,
parking distance. Shared by `MovingRequestFlow`/`PropertySection` (client) and
`POST /api/site/moving-request` (server) so the flow's "can continue" and the API's 422
use the same rules. Client-safe (no DB import).

## Exports
- `MOVING_HOME_TYPES` — `APARTMENT` (Leilighet), `TOWNHOUSE` (Rekkehus), `DETACHED` (Enebolig), `OFFICE` (Kontor).
- `MOVING_PARKING_OPTIONS` — `OUTSIDE` (Rett utenfor), `WITHIN_50M` (Innen 50 m), `FURTHER` (Lenger unna).
- `MOVING_MAX_FLOORS` — 4.
- `movingLiftApplies(homeType)` — the lift question only applies to apartments and offices.
- `emptyMovingProperty()` — the flow's starting `MovingPropertyDraft` (nothing picked, 1 floor).
- `parseMovingProperty(v)` — `{ ok: true, property }` or `{ ok: false, errors }` keyed by field
  (`homeType`, `sizeOptionCode`, `floors`, `hasLift`, `parking`; "Required"/"Invalid"). A non-object is
  treated as empty. `hasLift` is required when the lift applies, and nulled when it doesn't. Size codes
  are only checked for presence — the route checks them against the catalog.
- `isMovingEndReady({ address, addressSelected, property })` — address picked from the suggestions (not free-typed) and `parseMovingProperty` ok; gates the flow's next section and submit.
- `movingPropertyLine(property, sizeLabel)` — staff line, e.g. `Apartment, Under 40 m², 1 floor, lift: yes, parking: within 50 m`.
