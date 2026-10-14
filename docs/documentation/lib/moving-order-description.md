# `lib/orders/movingOrderDescription.ts`

## Purpose
Builds the `Order.description` for moving requests (`app/api/site/moving-request/route.ts`)
— where they're moving from/to and the additional services have no columns of their own,
so staff read them there.

## Functions
### `movingOrderDescription({ originLine, destinationLine, serviceLabels, notes })`
`Moving from: …`, `Moving to: …` (lines from `movingPropertyLine`), `Additional services: …`
when any, then the customer's notes — blank-line separated.
