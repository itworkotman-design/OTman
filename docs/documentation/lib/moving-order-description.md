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
