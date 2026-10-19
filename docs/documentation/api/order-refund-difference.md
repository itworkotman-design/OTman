# Order Refund Difference Route

## Source

- `app/api/orders/[orderId]/refund-difference/route.ts`

## Responsibility

"Refund difference" on a website order: its price went down after the
customer paid (a discount after a problem on the day, something removed), so
they have overpaid. Refunds exactly that amount through Stripe
(`refundOrderPayments`) and stores the order as it is now on the refund rows,
so `compareOrderWithPayments` shows it as settled and later changes compare
against it. The status is left alone — an `active` order stays `active`.

The client sends the amount it showed (`amountCents`); if the order changed
since, the route refuses with `AMOUNT_CHANGED` and the current amount rather
than refunding something staff didn't see.

After the refund: an order action event ("Refunded X kr…", with the changes)
and the `refund_issued` email (amount, changes, new total, link to My order).
The email is best-effort (`emailFailed: true`).

Access: `authorizeWebsiteOrderAdmin` (`lib/orders/websiteOrderAdminAccess.ts`).
UI: `WebsiteOrderRefundButton` under the payment summary in the order modal.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Body `{ amountCents }`. Responses: `{ ok, refundedCents, emailFailed? }`; `404 NOT_FOUND`; `409 NOTHING_TO_REFUND`; `409 AMOUNT_CHANGED` with `amountCents`; `409 REFUND_NOT_POSSIBLE`; `502 REFUND_FAILED` with `refundedCents`. |
