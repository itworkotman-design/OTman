# Customer order routes ("My order")

## Source

- `app/api/customer/orders/route.ts`
- `app/api/customer/orders/[orderNumber]/route.ts`
- `app/api/customer/orders/[orderNumber]/cancel/route.ts`

## Responsibility

A logged-in customer reads and changes their own homepage orders. Every route needs a customer session (`401` without one). An order is only found through the session's account; another account's order, or one that doesn't exist, returns `404`. The rules for what may change when are in `lib/orders/customerOrderEditPolicy.ts`, and the server checks them on every request.

### `GET /api/customer/orders`

Lists the account's orders: number, status, date, products and total.

### `GET /api/customer/orders/[orderNumber]`

Returns `customerOrderView`: the order summary, `permissions` (`open`, `beforeCutoff`, `cutoffAt`, `canEditItems`) and `details`. On a white-goods order it also returns what the booking flow's customer mode needs:

- `productCards`, normalized
- `drivingDistance`
- `pricingContext`: the express/discount/extra/deviation fees staff set. Partner prices are not included.
- `catalog`
- `categories`

### `PUT /api/customer/orders/[orderNumber]`

Body: `{ customer?: { name, phone, email, comments }, preferredDate?, timeWindow?, pickups?, delivery?, productCards?, shownTotal?, dryRun? }`. Any part left out stays as it is.

1. A closed order returns `409 ORDER_CLOSED`.
2. Contact details are required and validated. Invalid ones return `422 INVALID_DETAILS`. On a catalog order, the full details also go through `parseAdminOrderDetails`.
3. The route works out which kinds of change the request makes. If there are none, it returns `{ ok: true, changed: false }`. Kinds the permissions don't allow return `403 EDIT_NOT_ALLOWED` with `forbidden`.
4. A new date or time must pass `isAllowedNewSchedule`, otherwise it returns `422 INVALID_SCHEDULE`.
5. **Catalog order:**
   - Cards are checked with `validateWebsiteOrderCards` (`422` with the reason).
   - The distance comes from `resolveDrivingDistance`, the details from `buildDetailsUpdate`, and the price from `recomputeWebsiteOrderPricing` (strict).
   - A lower price on an order that already has payments returns `422 WOULD_DECREASE_PRICE`, because refunds aren't built.
   - `dryRun` returns `{ previousPriceExVat, priceExVat }` without saving.
   - If the price changed, `shownTotal` is required (`400 SHOWN_TOTAL_REQUIRED`) and must match the new price within 0.5 kr, otherwise `409 PRICE_CHANGED` with the real `priceExVat`.
   - The order is saved with `websiteOrderPricingWrites`.
6. **Moving or quote order:** only the contact details, comment, date and time window are written. The price doesn't change.
7. After saving:
   - an order history entry (`createOrderUpdatedEvent`, actor "Customer")
   - a `MANUAL_REVIEW` notification for staff listing every change and the price difference, with a note when the order was already sent to GSM
   - the customer's `order_updated` email

   None of these can turn a saved change into an error.

Payment isn't part of this. When Stripe goes live, the existing `/betaling/[token]` page charges the current total or balance.

### `POST /api/customer/orders/[orderNumber]/cancel`

Body `{ message? }`.

- **More than 24h before the time window:** the order is cancelled straight away (`status` and `statusChangedAt`), the cancelled-order partner is filled in, the status change is logged, and staff are notified. Returns `{ mode: "cancelled" }`.
- **Within 24h:** the status is left as it is. The cancellation request is logged as an inbound message in the order's Email Center thread, and staff get a notification. Returns `{ mode: "requested" }`.
- **Closed order:** returns `409 ORDER_CLOSED`.
