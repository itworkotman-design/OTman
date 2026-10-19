# Order Refunds

## Source

- `lib/orders/orderRefunds.ts`

## Responsibility

Sends money back to a website-order customer through Stripe. Every refund is
made against one recorded `OrderPayment` (a Stripe refund always targets one
payment intent) and written to the `OrderRefund` ledger, so what can still be
refunded is always charges minus refunds.

A refund spanning several payments (the original charge plus top-ups) takes
from the newest payment first.

Retry-safe: each Stripe call has an idempotency key built from the payment,
what it had already refunded and the amount, so retrying after a crash gets
the same Stripe refund back, and recording it twice is caught by the unique
`stripeRefundId` (P2002 is ignored). If Stripe fails partway, the refunds
that went through are already in the ledger and a retry only refunds the rest.

## Functions

| Function | Description |
| --- | --- |
| `sumRefundableCents` | Everything charged minus everything already refunded, across an order's payments. |
| `planOrderRefund` | Pure: splits an amount (or `"ALL"`) across payments, newest first. Fails with `INVALID_AMOUNT`, `NOTHING_TO_REFUND`, `EXCEEDS_REFUNDABLE` or `MISSING_PAYMENT_INTENT`. |
| `refundOrderPayments` | Loads the order's payments and refunds, plans, calls `stripe.refunds.create` per allocation and records each `OrderRefund` (with the optional `orderSnapshot` — the order after the refund, which `compareOrderWithPayments` then treats as the paid state). Returns the refunded cents, the plan's failure reason, or `STRIPE_ERROR` with what was refunded before the failure. |

## Used by

- `POST /api/orders/[orderId]/decline` (`"ALL"`).
- `POST /api/orders/[orderId]/refund-difference` (exactly the overpaid amount).
