# lib/booking/expressDelivery.ts

Decides whether an order counts as express delivery.

## Functions

- `isExpressDelivery({ deliveryDate, timeWindow, customTimeFrom, referenceTime })` — `true` when the delivery window start (`10:00` / `16:00` presets, `customTimeFrom` for `"custom"`, midnight otherwise) is less than 24 hours after `referenceTime`. `false` with no date or an invalid custom start. `BookingEditor` passes "now" for new orders and the order's `createdAt` for existing ones.
