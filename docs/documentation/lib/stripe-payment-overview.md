# lib/orders/stripePaymentOverview.ts

A homepage order's Stripe payment history and status (`HOMEPAGE_PAYMENT_MODE=stripe`; with manual payments the fakturas are the history, see `order-invoices.md`).

| Function | Purpose |
|---|---|
| `buildStripePaymentOverview(payments, current)` | Pure. Every `OrderPayment` newest first: the oldest is `booking` (paid at checkout), later ones `additional` (a paid "My order" change or a top-up), each with its refunds. Plus `comparison` (`compareOrderWithPayments`): `unpaid` / `due` / `refund` / `settled`, paid so far (net of refunds), the total now and the difference. |
| `getOrderStripePaymentOverview(orderId, companyId)` | Loads the order and its ledger, then the above. Null for an order that isn't this company's. Backs `GET /api/orders/[orderId]/payments` (the Alert Center's Payment tab). |
| `nextStripePaymentStatus(outcome)` | `Order.paymentStatus` from the comparison: `due` → `pending`, `refund` → `refund_pending` (red "Refund pending" badge; back to `paid` once "Refund difference" goes through, `refundOrderDifference.ts`), `settled` → `paid`, `unpaid` → null (a booking still in checkout keeps its status). Used by `refreshOrderPaymentStatus` (`lib/invoices/orderInvoices.ts`) after every price change. |
