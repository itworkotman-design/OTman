# WebsitePaymentRequestButton

`app/_components/Dahsboard/booking/websiteOrders/WebsitePaymentRequestButton.tsx`

Under a Stripe-paid website order's payment summary (`WebsiteOrderPanel`) when the customer owes more (`payment.outcome === "due"`, the price went up after they paid). "Send payment request (N kr)" asks for confirmation, then `POST /api/orders/[orderId]/request-payment` with the amount shown (`amountCents`), which emails the customer the balance-due email with a link to pay exactly the difference. Shows the result inline and calls `onSent` (the panel reloads). The counterpart of `WebsiteOrderRefundButton`.
