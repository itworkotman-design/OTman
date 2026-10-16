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
   - `dryRun` returns `{ previousPriceExVat, priceExVat, previousTotalIncVat, totalIncVat }` without saving. The `…IncVat` totals are what the customer sees and confirms: incl. VAT, summed per line (`websiteVat.ts`). `shownTotal` is compared with `totalIncVat`, and `PRICE_CHANGED` returns it. A change is priced with the order's saved catalog prices (`resolveSavedCatalogPricing`); only what's new is priced at today's catalog. A change whose prices would leave a product's delivery type or a selected option out (`missingPriceCardIds`) is refused with `409 PRICING_INCOMPLETE`.
   - If the price changed, `shownTotal` is required (`400 SHOWN_TOTAL_REQUIRED`) and must match the new price within 0.5 kr, otherwise `409 PRICE_CHANGED` with the real `priceExVat`.
   - The order is saved with `websiteOrderPricingWrites`.
6. **Moving or quote order:** only the contact details, comment, date and time window are written. The price doesn't change.
   - **Rejected order:** in either case, a `rejected` order is saved back to `processing` (with `statusChangedAt`) in the same write, because the customer has made the change it needed. A status-change event (actor "Customer") is added, and the staff notification says so.
   - **Pickup assignment:** before saving a catalog order, `findCardsWithoutPickup` checks the final stops and cards. A product without a pickup stop returns `422 PRODUCT_WITHOUT_PICKUP` with `cardIds`. When the stops change, a stop that collects no products returns `422 PICKUP_WITHOUT_PRODUCT` with `pickups` (stop indexes), via `findPickupsWithoutProducts`; an older order that already has an empty stop can still change e.g. its contact details. A contact person sent on a store pickup is dropped by `parseAdminOrderDetails`.
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

## Homepage moves
A `MOVING` order with stored answers is edited as a whole move (`moving`: addresses, both ends, services —
`lib/orders/movingOrderEdit.ts`), classified into a delivery order's change kinds so the same 24h policy applies: anything
until 24h before the job, then only contact details and adding services. A change is re-priced like a booking
(`priceMovingOrder`, distance looked up again when an address moved) keeping any discount/extra staff gave it
(`movingOrderSaveData` with `movingAdjustmentsFromOrder`, lines set to 0 included), must confirm the shown total (`shownTotal`, else
`SHOWN_TOTAL_REQUIRED`/`PRICE_CHANGED`), never makes a paid order cheaper (`WOULD_DECREASE_PRICE`), and is followed by the same
history event, staff notification and "order updated" email as a delivery order. `GET` skips the white-goods catalog for a move
and returns `pricingContext: { rabatt, leggTil, nulledLineKeys, staffLines }` (`staffLines`: express/deviation lines staff
added, `movingStaffLines` — carried over as priced on a re-price) (customer side only) for the flow's live price.
Tested in `route.moving.test.ts`.

## Service requests
`details.kind === "service"` carries `service: { address, services: [{ serviceCode, customService, jobDescription }] }` (never the quotes). A PUT with `service` is validated with `parseServiceEdit` — each service keeps its stored quote, a new one has none — and classified by `classifyServiceEdit`: a new address is `addresses`, a service added/removed `reconfigure` (both locked within 24h), a job description `notes` (always allowed). Saved with `serviceOrderSaveData` + `serviceOrderItemWrites` (express/deviation and adjustments kept). Adding a service keeps the price (staff quote it); removing a quoted one drops its line and lowers the price, so it needs `shownTotal` like any price change, and is refused with `WOULD_DECREASE_PRICE` on a paid order. The staff notification and customer email list services added/removed and changed job descriptions.
