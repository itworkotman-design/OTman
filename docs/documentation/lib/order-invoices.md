# Order Invoices

## Source

- `lib/invoices/orderInvoices.ts`

## Responsibility

The DB side of manual faktura payments for homepage orders (`lib/orders/manualPayments.ts` is the pure ledger).

## Functions

| Function | Description |
| --- | --- |
| `sendOrderInvoice({ orderId, companyId, actor, kind, expectedAmountCents?, now? })` | `kind: "invoice"` — a faktura for what the order costs beyond what's been invoiced (the whole total the first time). `kind: "refund"` — a kreditnota for what was invoiced beyond the total, recorded as settled (`paidAt` set). Claims the next `sequence` first (unique per order, so a double click can't send twice), renders the PDF with every faktura so far, stores it on S3 (`OrderInvoice.pdfKey`), emails it through the order's Gmail thread (logged in the Conversation tab), then sets `Order.paymentStatus` and logs an order event. If anything before the email is confirmed fails, the row is deleted: a faktura is never recorded as sent when it wasn't. `expectedAmountCents` (the admin's button) must still match, else `AMOUNT_CHANGED` with the current amount. Other refusals: `INVOICE_SETTINGS_MISSING`, `MISSING_CUSTOMER_EMAIL`, `NOTHING_TO_INVOICE`, `NOTHING_TO_REFUND`, `INVOICE_IN_PROGRESS`, `INVOICE_SEND_FAILED`. |
| `markOrderInvoicesPaid({ orderId, companyId, actor, now? })` | The Mark paid button: every unpaid faktura gets `paidAt`/`paidByMembershipId`, then the status is recomputed — `paid` when that covers the current total. The only way an order becomes paid. `NOTHING_TO_MARK_PAID` when none is unpaid. |
| `refreshOrderPaymentStatus(orderId)` | Called after anything that changes a price (admin saves in `website-items`, `moving-details`, `service-details`; the customer's "My order" save): recomputes `Order.paymentStatus` with `nextPaymentStatus`. Orders without fakturas are left alone. |
| `getOrderInvoiceOverview(orderId, companyId)` | The Payment card / Payment tab data: every faktura (number, kind, amounts, dates, sent by / paid by names, whether a PDF is stored), the ledger against the order now, and the payment status. |
