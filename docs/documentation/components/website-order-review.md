# Website Order Review (logic)

## Source

- `app/_components/site/BookingModal/whiteGoods/orderReview.ts`

## Responsibility

Builds the text half of the homepage white-goods flow's review page (the `SteppedModal` final step, reached via the "Your details" step's "Go to summary" button). Turns the pickup(s), delivery and contact answers into labelled rows for the customer to check before submitting. Products and prices are rendered next to it by `WhiteGoodsOrderSummary`. Framework-free (no React) so it's unit-tested without a DOM, the same convention as `pickupLocations.ts`.

## Types

| Type | Purpose |
|---|---|
| `ReviewPickup` | One pickup location's answers. `productNames` is only set once the order is split across locations, matching the submitted payload. |
| `ReviewRow` / `ReviewBlock` | A labelled value, and a titled card of them. `ReviewBlock.kind` is `"location"` for pickups, delivery and a move's two ends (the review page puts a location pin on those), `"details"` for a move's timing (`moving/movingReview.ts`) and `"contact"` for Your details. Rendered by `OrderReviewParts.tsx`'s `OrderReviewBlocks`. |

## Functions

| Function | Purpose |
|---|---|
| `buildOrderReviewBlocks` | Returns the pickup block(s) (numbered "Pickup 1", "Pickup 2" once there's more than one), then Delivery, then Your details. Rows for blank answers (place name, floor, driving distance, notes) are left out. The date is shown long-form ("5. oktober 2026"), read as a UTC calendar date so it can't shift by timezone. The name row is "Full name" for a private customer and "Company name" for a business, which also gets an "Org. no." row (`contact.customerType` / `contact.orgNumber`; the admin modal and partner view pass them from the booking details). |
| `markCopyableRows` | Marks every "Address" row and the "Phone" row `copy: true`, so the admin panel shows a copy button beside them (`OrderReviewBlocks`). The homepage review steps don’t call it. |
| `formatOrgNumber` | `974760673` → `974 760 673`; anything that isn't 9 digits is returned as-is. |
