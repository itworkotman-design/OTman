# `lib/orders/movingOrderView.ts`

## Purpose
A move's price as stored on the order (`Order.items`), in the shapes the admin `WebsiteOrderModal` and the partner view
render: the move (size + services) as one product, surcharges and km as order extras. Kroner ex. VAT, each line rounded
like `movingOrderPricing`, so the lines add up to the stored total. Tested.

## Functions
- `movingOrderPriceView(items, "customer" | "partner")` — `{ products, orderExtras, total }`.
- `isMovingOrderItems(items)` — has a `MOVING_BY_SIZE` line.
