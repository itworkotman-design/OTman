# lib/invoices/refundCreditNotes.ts

The credit note (kreditnota) for each Stripe refund (`OrderRefund`) on a homepage order. It's the sales document for money paid back, as the receipt is for money taken.

- `sendRefundCreditNote({ refundId, resend?, now? })`:
  - Gives the refund the next W-number (`allocateReceiptNumber`, the same series as the receipts). A number already given is kept.
  - Draws the PDF (it refers to the receipt it credits) and sends it with `emailSalesDocument`.
  - Logs a "Credit note W-N sent" event and sets `receiptSentAt` / `receiptPdfKey`.
  - Refuses a second send unless `resend`.
  - Never throws: staff get a "Credit note not sent" alert when it can't go out.
- `sendCreditNotesForStripeRefunds(stripeRefundIds)`: the credit notes for the refunds `refundOrderPayments` just made, oldest first. Never throws.
- `creditNoteForRefund(refund, number, seller)` and `CREDIT_NOTE_REFUND_SELECT`: the credit note for a stored refund, also used by the download route.

Called after every `refundOrderPayments`: the decline route, `refundOrderDifference`, and the failed paid change in `customerOrderPaidChange.ts`. It also covers refunds that went through before a partial Stripe failure.
