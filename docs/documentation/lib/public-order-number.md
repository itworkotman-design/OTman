# Homepage order numbers

The order number website customers see (lifecycle emails, the Stripe charge label, the pay / "My order" pages and the confirmation screens) is stored in `Order.orderNumber`.

Since 2026-11-04 a new homepage order's number is its order id: `String(displayId)`, set as the order is created in `app/api/site/white-goods-order`, `moving-request`, `service-request` and `special-goods-quote`. The random 8-character generator (`lib/orders/publicOrderNumber.ts`) is removed.

Older orders keep the random code they were given (e.g. `83KCDR6Z`): customers have it in their emails and "My order" links, so it is never rewritten.
