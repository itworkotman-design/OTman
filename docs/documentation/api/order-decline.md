# Order Decline Route

## Source

- `app/api/orders/[orderId]/decline/route.ts`

## Responsibility

"Decline" on a website order: a job we can't or won't do. Unlike "needs
change" (status `rejected`, the customer can fix the order), the order is
closed for good:

1. Everything paid is refunded through Stripe (`refundOrderPayments`, `"ALL"`).
2. Only then is the status set: `refunded`, or `cancelled` when nothing had
   been paid (a service still waiting for its payment link). The reason is
   stored as `statusNotes`.
3. The cancelled-order placeholder partner is filled in if the order has no
   partner, a status event is logged and open notifications are resolved.
4. The customer gets the `order_declined` email (reason + refunded amount, no
   action links). Best-effort: a failed email returns `emailFailed: true`,
   never an error, since the money has already gone back.

This is the only way an order becomes `refunded` — the status dropdown and
`PATCH /api/orders/bulk` don't offer it — so that status always means the
refund really happened.

Access: company owner/admin, or `WEBSITE_ORDERS` at `ADMIN` level.

## Functions

| Function | Description |
| --- | --- |
| (auth) | `authorizeWebsiteOrderAdmin` (`lib/orders/websiteOrderAdminAccess.ts`). |
| `POST` | Body `{ reason }`. Responses: `{ ok, status, refundedCents, emailFailed? }`; `400 REASON_REQUIRED`; `404 NOT_FOUND` (not in the company / not a website order); `409 NOT_DECLINABLE` (completed, cancelled, refunded); `409 REFUND_NOT_POSSIBLE` (a payment has no Stripe payment intent); `502 REFUND_FAILED` with `refundedCents` (Stripe error, order untouched). |
