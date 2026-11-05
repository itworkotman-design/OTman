# lib/invoices/receiptDocument.ts

The content of the web-sales documents: the receipt (kvittering) for a Stripe payment and the credit note (kreditnota) for a Stripe refund. Pure; drawn by `receiptPdf.ts`. Both are numbered W-<n> (`receiptSeries.ts`).

- `receiptSellerFromEnv(env)`: the seller from `INVOICE_SELLER_NAME`, `INVOICE_ORG_NUMBER` (both required), `INVOICE_ADDRESS` and `INVOICE_EMAIL`. Unlike the faktura, no bank account is needed.
- `receiptPreviousSnapshot(payment, payments, refunds)`: the order as of the last payment or refund before this payment. Null for the first payment.
- `creditNotePreviousSnapshot(refund, payments, refunds)`: the same for a refund.
- `buildReceipt(...)`: the receipt's content (`kind: "receipt"`).
  - First payment: every line.
  - Later payments: only what changed.
  - Line names are in Norwegian (`localizeWebsiteProductName` / `localizeWebsiteLineLabel`).
  - The total is the amount charged, with 25 % VAT split out of it.
- `buildCreditNote(...)`: the credit note's content (`kind: "creditNote"`).
  - Negative amounts, and `creditsReceiptNumber`: the receipt of the payment it pays back.
  - Lists what was removed when the refund settles a price change and those lines add up to the refund. Otherwise (a declined order, a refund split across two payments) it's one "Tilbakebetaling for ordre N" line.
- `receiptFilename(number, kind?)`: `Kvittering W-7.pdf` / `Kreditnota W-12.pdf`.
- `buildReceiptEmail(...)`, `buildCreditNoteEmail(...)`: the emails they go out with.
