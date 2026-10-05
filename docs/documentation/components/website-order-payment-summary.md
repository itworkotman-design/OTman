# Website Order Payment Summary

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderPaymentSummary.tsx`

## Responsibility

Renders a `compareOrderWithPayments` result:

- **Amounts:** paid so far (with the date), the order total now (or the new total in the editor) and the signed difference.
- **One outcome line:** "not paid yet", "customer must pay X more", "customer overpaid X — refund manually in Stripe", or "fully paid".
- **Changes:** every line and stop changed since payment, worded by `orderChangeText` and coloured by price effect.

It notes when a payment predates itemized snapshots. It is used in the modal's Payment panel and in `WebsiteOrderAdminFooter`.
