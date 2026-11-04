# lib/invoices/receiptDocument.ts

The content of a receipt (kvittering) for a Stripe payment on a homepage order. Pure; drawn by `receiptPdf.ts`.

- `receiptSellerFromEnv(env)`: the seller from `INVOICE_SELLER_NAME`, `INVOICE_ORG_NUMBER` (both required), `INVOICE_ADDRESS` and `INVOICE_EMAIL`. Unlike the faktura, no bank account is needed.
- `receiptPreviousSnapshot(payment, payments, refunds)`: the order as of the last payment or refund before this payment. Null for the first payment.
- `buildReceipt(...)`: the receipt's content.
  - First payment: every line.
  - Later payments: only what changed.
  - Line names are in Norwegian (`localizeWebsiteProductName` / `localizeWebsiteLineLabel`).
  - The total is the amount charged, with 25 % VAT split out of it.
- `receiptFilename(number)`, `buildReceiptEmail(...)`: the attachment's file name and the email it goes out with.
