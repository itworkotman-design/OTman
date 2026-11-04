# lib/invoices/paymentReceipts.ts

The receipt for each Stripe payment (`OrderPayment`) on a homepage order.

- `sendPaymentReceipt({ paymentId, resend?, now? })`:
  - Gives the payment the next number in one series across all orders (`receiptNumber`). The number is unique; on a race it takes the next one, and a number already given is kept.
  - Draws the PDF, keeps it in S3 (`receipts/<orderId>/`, `receiptPdfKey`) and emails it on the order's thread.
  - Logs the email and a "Receipt N sent" event, and sets `receiptSentAt`.
  - Refuses a second send unless `resend`.
  - Never throws: when the receipt can't go out (no seller settings, no customer email, the email failed), staff get a "Receipt not sent" alert.
- `receiptForPayment(payment, number, seller)` and `RECEIPT_PAYMENT_SELECT`: the receipt for a stored payment, also used by the download route.

Called by `handleCheckoutSessionCompleted` (`lib/stripe/checkoutSessionHandlers.ts`) once per newly recorded payment, after the order emails.
