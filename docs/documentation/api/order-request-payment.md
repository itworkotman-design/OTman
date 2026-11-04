# POST /api/orders/[orderId]/request-payment

`app/api/orders/[orderId]/request-payment/route.ts`

"Send payment request" on a website order paid by Stripe whose price went up afterwards. Admins only (`authorizeWebsiteOrderAdmin`); 409 `PAYMENTS_ARE_MANUAL` with `HOMEPAGE_PAYMENT_MODE=manual` (fakturas collect the difference then).

Body: `{ amountCents }`, the amount staff saw. Calls `requestOrderBalancePayment` (`lib/orders/requestOrderBalancePayment.ts`, doc: `../lib/request-order-balance-payment.md`) and returns `{ ok: true, amountCents }`, or `{ ok: false, reason, amountCents? }` with its status: `NOT_FOUND` 404, `NOTHING_DUE` / `AMOUNT_CHANGED` (with the current amount) / `MISSING_CUSTOMER_EMAIL` 409, `EMAIL_FAILED` 502.
