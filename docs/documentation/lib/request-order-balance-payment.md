# lib/orders/requestOrderBalancePayment.ts

The counterpart of `refundOrderDifference.ts`: a website order's price went up after the customer paid by Stripe, so they owe the difference.

| Function | Purpose |
|---|---|
| `requestOrderBalancePayment({ orderId, companyId, actor, expectedAmountCents })` | Compares the order now with its payments (`compareOrderWithPayments`); refuses unless the outcome is `due` and the difference matches `expectedAmountCents`. Mints the order's `actionToken` if it has none, sends the `balance_due` lifecycle email (paid so far, new total, amount due, what changed; link to `/betaling/[token]`, which charges just the difference as a top-up, `isTopUpPayable`), and logs "Sent payment request for N kr". The Stripe webhook records the payment and sets the payment status to paid. |
