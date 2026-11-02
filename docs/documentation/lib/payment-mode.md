# Payment Mode

## Source

- `lib/orders/paymentMode.ts`

## Responsibility

How homepage orders are paid, from `HOMEPAGE_PAYMENT_MODE`: `manual` (the default until Stripe is connected) or `stripe`.

In `manual` mode:
- the first faktura is emailed when the customer books (`welcomeWebsiteOrderCustomer`), and staff send further fakturas / kreditnotas and mark them paid (`lib/invoices/`);
- the Stripe flow is off: `website-items` refuses `sendPaymentLink` (`PAYMENT_LINKS_DISABLED`), the public checkout returns `PAYMENTS_ARE_MANUAL`, Decline only cancels (no Stripe refund), and the payment-timeout sweep does nothing;
- `website-details` returns `paymentMode`, so the modal's Payment card is the faktura card (`WebsiteOrderInvoiceSummary`) instead of the Stripe comparison.

None of the Stripe code is removed; setting `stripe` brings it back.

## Functions

| Function | Description |
| --- | --- |
| `homepagePaymentMode(env?)` | `"stripe"` only when the variable says so; otherwise `"manual"`. |
| `isManualPaymentMode(env?)` | Shorthand for the check above. |
