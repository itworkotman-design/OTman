# `lib/orders/movingOrderWrites.ts`

## Purpose
`movingOrderSaveWrites(orderId, save, extra)` — a re-priced move saved in one transaction: the move's lines
(`MOVING_ITEM_PRODUCT_CODES`) replaced, the order updated (plus `extra`: contact, schedule, a reopened status). `MOVING_ITEM_PRODUCT_CODES` includes the express/deviation lines
(`MOVING_EXPRESS`, `MOVING_DEVIATION`).
`movingOrderItemWrites(orderId, itemRows, data)` — the same with any lines (moving-details when only express or the
deviation changed).
