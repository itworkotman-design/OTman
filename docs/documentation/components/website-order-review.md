# Website Order Review (logic)

## Source

- `app/_components/site/BookingModal/whiteGoods/orderReview.ts`

## Responsibility

Builds the text half of the homepage white-goods flow's review page (the `SteppedModal` final step, reached via the "Your details" step's "Go to summary" button). Turns the pickup(s), delivery and contact answers into labelled rows for the customer to check before submitting. Products and prices are rendered next to it by `WhiteGoodsOrderSummary`. Framework-free (no React) so it's unit-tested without a DOM, the same convention as `pickupLocations.ts`.

## Types

| Type | Purpose |
|---|---|
| `ReviewPickup` | One pickup location's answers. `productNames` is only set once the order is split across locations, matching the submitted payload. |
| `ReviewRow` / `ReviewBlock` | A labelled value, and a titled card of them. |

## Functions

| Function | Purpose |
|---|---|
| `buildOrderReviewBlocks` | Returns the pickup block(s) (numbered "Pickup 1", "Pickup 2" once there's more than one), then Delivery, then Your details. Rows for blank answers (place name, floor, driving distance, notes) are left out. The date is shown long-form ("5. oktober 2026"), read as a UTC calendar date so it can't shift by timezone. |
