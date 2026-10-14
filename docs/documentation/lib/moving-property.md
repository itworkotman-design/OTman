# `lib/orders/movingProperty.ts`

## Purpose
One end of a move (origin or destination): property type, size bracket, floors, lift,
parking distance. Shared by `MovingRequestFlow`/`PropertySection` (client) and
`POST /api/site/moving-request` (server) so the flow's "can continue" and the API's 422
use the same rules. Client-safe (no DB import).

## Exports
- `MOVING_HOME_TYPES` — `APARTMENT` (Leilighet), `TOWNHOUSE` (Rekkehus), `DETACHED` (Enebolig), `OFFICE` (Kontor).
- `MOVING_PARKING_OPTIONS` — `OUTSIDE` (Rett utenfor, free), `WITHIN_50M` (Innen 50 m), `FURTHER` (Lenger unna); each `surchargeCode` names its carrying-distance line on the moving price list (`CARRY_WITHIN_50M`/`CARRY_FURTHER`, null for outside).
- `MOVING_MAX_FLOORS` — 4.
- `movingLiftApplies(homeType)` — the lift question only applies to apartments and offices.
- `floorNumber` (draft + parsed) — which floor it's on; asked (before the lift) and required for every apartment/office. Whole, non-zero, up to 3 digits (1 = ground floor, -1 = first basement, as in the delivery modal); nulled for houses/townhouses. Only costs extra with no lift.
- `movingDraftChargeableFloors(draft)` — the same straight from the flow's draft (only while the lift question applies to the picked type), so the live calculator and "+N kr" pill follow the floor box before size/parking are answered.
- `movingChargeableFloors(property)` — floors that cost extra: `getChargeableFloors` (the delivery modal's rule: free up to the 2nd floor and down to -1), only with no lift.
- `emptyMovingProperty()` — the flow's starting `MovingPropertyDraft` (nothing picked, 1 floor).
- `parseMovingProperty(v)` — `{ ok: true, property }` or `{ ok: false, errors }` keyed by field
  (`homeType`, `sizeOptionCode`, `floors`, `hasLift`, `parking`; "Required"/"Invalid"). A non-object is
  treated as empty. `hasLift` is required when the lift applies, and nulled when it doesn't. Size codes
  are only checked for presence — the route checks them against the catalog.
- `isMovingEndWhereReady({ address, addressSelected, property })` — the address + type section: address picked from the suggestions and a type chosen.
- `isMovingEndReady({ address, addressSelected, property })` — address picked from the suggestions (not free-typed) and `parseMovingProperty` ok; gates the flow's next section and submit.
- `movingPropertyLine(property, sizeLabel)` — staff line, e.g. `Apartment, Under 40 m², 1 floor, on floor 4, lift: no, parking: within 50 m`.
