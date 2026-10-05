# GET / PUT /api/orders/[orderId]/website-items

## Source

- `app/api/orders/[orderId]/website-items/route.ts`

## Responsibility

Backs the admin mode of the booking flow (`WhiteGoodsBookingFlow` with `admin`, opened from `WebsiteOrderModal`), used for example when a customer phones in. The admin can change products (from any website category) and every detail: customer, pickup stops, delivery, floors/lifts, date/time and distance. Changes are re-priced through the booking pipeline, and the editor shows exactly how the result compares with what the customer has paid.

**Access:** a company `OWNER`/`ADMIN`, or a member with `WEBSITE_ORDERS` at `ADMIN` level. The order must be a homepage white-goods order (`websiteOrderKind = WHITE_GOODS`) in the active company, otherwise `404`. On cancelled, completed, invoiced and paid orders, products and details return `409 NOT_EDITABLE_STATUS`; `handling` can still be saved, because deviations, drivers and so on are often only known after the trip.

## Functions

- `GET` — returns `productCards`, `customerType`, `details` (`editableDetailsFromOrder`), `drivingDistance`, `handling` (so the editor's live price includes express, discount, extra and deviation), `comparison` (`compareOrderWithPayments` for the order as it is), `catalogProducts` and `categories` (one per seeded website price list).
- `PUT { productCards?, details?, handling?, sendPaymentLink?, dryRun? }`. Omitted parts stay as stored.
  - **`handling`** (`parseWebsiteOrderHandling`) covers the admin-only fields. Fields left out keep their stored value. The fields are: delivery date and time window (also written to `websiteBookingDetails` via `scheduleBookingDetails`, and logged), driver(s), driver info, license plate, description, deviation (plus a custom deviation's prices and description), discount, extra and express delivery. They're laid over the order before re-pricing, so express, discount, extra and the deviation are charged; they're written to the order and logged. A bad amount or unknown deviation returns `422 INVALID_HANDLING` with `errors`.
  - **Validation:** an admin can save anything, including no products, an empty field, or an incomplete product such as installation-only without its installation or Other furniture without its size. Re-pricing runs with `allowIncomplete`. The only refusals are `422 UNKNOWN_PRODUCT` (a product not sold on the website) and `422 INVALID_DETAILS` with `errors` for a filled-in field in the wrong format (phone, email, contact phone, distance).
  - **Distance:** the editor sends the distance it priced with as the override, and that is used. Otherwise Mapbox (`getRouteDistance`) recalculates it when every stop has an address and one of them, or the stop count, changed. In every other case, or when Mapbox fails, the stored distance is kept.
  - **Re-pricing:** `recomputeWebsiteOrderPricing` runs on the order with the new details laid over it. Then `comparison` is built for the result against the payments.
  - **`dryRun`:** returns `{ dryRun, previousPriceExVat, priceExVat, drivingDistance, comparison }` and nothing is saved, logged or sent.
  - **`sendPaymentLink`:** `planWebsiteOrderPaymentLink` decides before saving; `409` with `MISSING_CUSTOMER_EMAIL` / `NOTHING_TO_PAY` / `NOT_PAYABLE_STATUS` saves nothing. The email address entered in the same save is the one used. A not-yet-approved order is approved in the same write, then gets `payment_request`. A paid order that owes more gets `balance_due` with the explicit breakdown (paid, new total, due, change lines).
  - **Save:** one transaction (`websiteOrderPricingWrites` + the details columns), then an `OrderUpdatedEvent` listing changed customer/address/date/distance/products/price/status fields.
  - **Response:** `200 { ok, previousPriceExVat, priceExVat, drivingDistance, comparison, emailSent, emailFailed }`.

Nothing is refunded automatically. A cheaper paid order shows `outcome: "refund"`. A change does not update an order already sent to GSM.

GET also returns `useFullDistanceKmPricing` (from the order's `createdAt`), so the admin editor's live price uses the same km rule as the server.

`PUT` also takes `nulledLines` (the calculator's "Set to 0" choices; `parseNulledLines`):
- **Product lines:** written onto the product cards (`nulledLineKeysForCustomer` / `nulledLineKeysForSubcontractor`).
- **Order extras:** passed to repricing and kept in the pricing snapshot.
- **Finished orders:** like discounts, allowed on completed or invoiced orders.
- **Malformed:** returns `400 INVALID_BODY`.
