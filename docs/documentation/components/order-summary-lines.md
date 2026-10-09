# `app/_components/site/BookingModal/whiteGoods/orderSummaryLines.ts`

## Purpose
Orders a product's calculator lines: delivery lines (main delivery, then extra delivery) first, everything else after in original order.

## Functions
### `sortSummaryLines(lines)`

### `buildOrderAdjustmentLines(totals, locale)`
A staff discount (`rabatt`) and extra charge (`leggTil`) as order-level summary lines ("Rabatt −500 kr", "Tillegg"), so the summary's lines add up to its total in "My order" and the admin editor.
