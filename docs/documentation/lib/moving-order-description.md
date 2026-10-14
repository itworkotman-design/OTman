# `lib/orders/movingOrderDescription.ts`

## Purpose
Builds the `Order.description` for moving requests (`app/api/site/moving-request/route.ts`)
— size and floors have no columns of their own, so staff read them there.

## Functions
### `parseMovingFloors(v)`
Optional `floors` field: missing → `{ ok: true, floors: null }`; otherwise must be an
integer 1..`MOVING_MAX_FLOORS` (4), else `{ ok: false }` (route answers 422 `errors.floors`).
### `movingOrderDescription({ sizeLabel, floors, notes })`
`Approximate size: …`, `Floors: N`, then the customer's notes, blank-line separated.
### `MOVING_HOME_TYPES` / `parseMovingHomeType(v)`
Home types for the flow's home-type step: `APARTMENT` (Leilighet), `TOWNHOUSE`
(Rekkehus), `DETACHED` (Enebolig), `OFFICE` (Kontor). Client-safe. Parser: missing → `{ ok: true,
homeType: null }`, unknown → `{ ok: false }` (route answers 422 `errors.homeType`).
Written to the description as `Property type: …` right after the size line.
