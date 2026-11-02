# Website Order Invoice Summary

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderInvoiceSummary.tsx`

## Responsibility

The Payment card of a homepage order (`WebsiteOrderPanel`, right column) while payments are manual (`paymentMode: "manual"` from `website-details`).

- The payment badge (Payment pending / Paid) and a mini history: every faktura and kreditnota sent, its amount, date and Paid/Pending.
- How the order stands (`paymentCardState`): "Faktura sent – 1 250 kr. Waiting for payment.", "Paid", or "Customer paid 1 250 kr. The order is now 1 860 kr: +610 kr to invoice." / "… −300 kr owed to the customer."
- It follows the calculator live: `WebsiteOrderCalculator` reports its unsaved total (`onPreviewTotalChange`), and the card shows "After this change the order is …". Its buttons only work on a saved order ("Save the order to invoice the difference.").
- Buttons (each confirms first): **Send faktura** (the first one or for the difference), **Record refund** (a kreditnota, emailed), **Mark as paid**. They call `POST /api/orders/[orderId]/invoices` (with the amount shown) and `…/invoices/mark-paid`, then reload the card and the order.

Loads `GET /api/orders/[orderId]/invoices`; non-admins see a short note instead. In `stripe` mode the panel shows `WebsiteOrderPaymentSummary` instead.
