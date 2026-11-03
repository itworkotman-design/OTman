# Booking Payment (paying at booking with Stripe)

## Source

- `lib/orders/bookingPayment.ts` — the pure check.
- `lib/orders/bookingCheckout.ts` — the Stripe/database side effects.
- `lib/stripe/orderCheckoutSession.ts` — the Checkout Session builder shared with the token checkout route.

## Responsibility

With `HOMEPAGE_PAYMENT_MODE=stripe` (see `payment-mode.md`) a homepage white-goods or moving order is paid as it is placed:

1. `app/api/site/white-goods-order` (and `app/api/site/moving-request`) saves the order as `status: "processing"`, `paymentStatus: "pending"` with a new `actionToken`, then calls `startBookingCheckout`. The browser is sent to the returned Checkout URL. No staff alert and no customer email yet.
2. The Checkout Session expires after `BOOKING_CHECKOUT_MINUTES` (31; Stripe's minimum is 30). Success and cancel both return to `/betaling/[token]`, where the customer can retry (a new session replaces the old one).
3. `checkout.session.completed` (Stripe webhook): the order stays `processing` for staff to confirm, and `paymentStatus` becomes `"paid"`. `welcomePaidBookingOrder` then raises the `WEBSITE ORDER - PAID` staff alert and runs `welcomeWebsiteOrderCustomer` ("My order" login + order-received email).
4. `checkout.session.expired` for the order's latest booking session, still unpaid: `cancelUnpaidBookingOrder` cancels the order.

If Stripe can't open a session, the order is cancelled at once and the order route answers `502 PAYMENT_START_FAILED`.

## Functions

| Function | Description |
| --- | --- |
| `isAwaitingBookingPayment(order)` | `processing` + `paymentStatus "pending"` + no Stripe payments recorded. |
| `startBookingCheckout(order)` | Opens the short-lived booking session for the order's total incl. VAT and stores its id. Never throws; cancels the order on failure. |
| `cancelUnpaidBookingOrder(order, { sessionId?, note })` | Cancels only while still unpaid (and on that session, if given), via a conditional `updateMany`, so a payment landing at the same moment wins. Logs a status-changed event. |
| `welcomePaidBookingOrder(orderId)` | Staff alert + customer welcome after the payment. |
| `createOrderCheckoutSession(stripe, params)` | One Checkout Session (NOK, labelled with the public order number). `chargeKind` `"booking"` adds `expires_at`; `"topup"` labels it as an additional payment. |
