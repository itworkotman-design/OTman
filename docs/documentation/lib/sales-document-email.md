# lib/invoices/salesDocumentEmail.ts

`emailSalesDocument({ orderId, companyId, order, subject, html, filename, pdf, now })` sends a receipt or credit note to the customer:

- keeps the PDF in S3 (`receipts/<orderId>/`) when S3 is configured, and returns `{ pdfKey }`;
- emails it in the order's Gmail thread (creating the thread token if the order has none);
- logs an `OrderEmailMessage` and sets `Order.lastOutboundEmailAt`.

Throws when the email can't be sent. The callers (`paymentReceipts.ts`, `refundCreditNotes.ts`) turn that into a staff alert.
