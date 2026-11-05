# lib/invoices/paymentReceipts.ts

The receipt for each Stripe payment (`OrderPayment`) on a homepage order.

- `sendPaymentReceipt({ paymentId, resend?, now? })`:
  - Gives the payment the next number in the web-sales series W-<n> (`allocateReceiptNumber`, `receiptNumbers.ts`), which it shares with refund credit notes. A number already given is kept.
  - Draws the PDF and sends it with `emailSalesDocument` (`salesDocumentEmail.ts`): kept in S3 (`receipts/<orderId>/`, `receiptPdfKey`), emailed on the order's thread, and logged.
  - Logs a "Receipt W-N sent" event and sets `receiptSentAt`.
  - Refuses a second send unless `resend`.
  - Never throws: when the receipt can't go out (no seller settings, no customer email, the email failed), staff get a "Receipt not sent" alert.
- `receiptForPayment(payment, number, seller)` and `RECEIPT_PAYMENT_SELECT`: the receipt for a stored payment, also used by the download route.

Called by `handleCheckoutSessionCompleted` (`lib/stripe/checkoutSessionHandlers.ts`) once per newly recorded payment, after the order emails.
