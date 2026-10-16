# `lib/orders/movingHandlingLines.ts`

## Purpose
Express delivery and the deviation fee on a homepage move, set by an admin in "Handle order" (`PUT /api/orders/[orderId]/moving-details`).
Priced like a delivery's (`buildCalculatorBreakdownsWithOrderExtras`): from the moving price list's `EXPRESS_DELIVERY` and deviation
settings (`getMovingCatalog().handlingRates`). A custom deviation uses its own prices and is named by its description. They are stored as
the move's own order lines (`MOVING_EXPRESS` / `MOVING_DEVIATION`), so the calculator, partner view and "My order" show them as order
extras. They are priced when set, then carried over as priced by any re-price (an edit, "Use new price", the customer's own change).
Tested in `movingHandlingLines.test.ts` and the moving-details / customer-orders route tests.

## Functions
- `movingHandlingItemRows(rates, { expressDelivery, deviation, customDeviation })`: the lines, in `movingOrderItemRows`' shape.
  Without rates, a deviation falls back to its built-in fee.
- `storedMovingHandlingRows(items)`: the order's stored lines as rows to write again.
- `movingStaffLines(items)`: those lines for the customer's page (`pricingContext.staffLines`), keyed like `movingLineKey`.
- `movingHandlingLinesChanged(stored, next)`: whether express, the deviation or a custom deviation's values changed.
- `movingHandlingFromOrder(order)`: `handlingFromOrder`, plus a custom deviation's prices and description read from its line.
- `isMovingHandlingItem(item)`.
