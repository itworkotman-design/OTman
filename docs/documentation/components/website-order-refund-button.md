# Website Order Refund Button

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderRefundButton.tsx`

## Responsibility

Shown in the order modal under the payment summary when the saved order is
overpaid (`payment.outcome === "refund"`). After a confirm dialog it calls
`POST /api/orders/[orderId]/refund-difference` with the amount it shows, then
reloads the order. Maps the route's reasons (`AMOUNT_CHANGED`,
`REFUND_FAILED`, …) to messages, and warns when the customer email failed.
