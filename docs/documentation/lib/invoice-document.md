# Invoice Document

## Source

- `lib/invoices/invoiceDocument.ts`

## Responsibility

What `sendOrderInvoice` needs around the PDF (`invoicePdf.ts`): the seller's details, who's billed, the stored fakturas as the file's entries, and the email the PDF goes out with.

## Functions

| Function | Description |
| --- | --- |
| `invoiceSellerFromEnv(env?)` | Reads `INVOICE_SELLER_NAME`, `INVOICE_ORG_NUMBER`, `INVOICE_ADDRESS`, `INVOICE_BANK_ACCOUNT`, `INVOICE_EMAIL` and `INVOICE_DUE_DAYS` (default 14). Null without a name or bank account — then no faktura can be sent (`INVOICE_SETTINGS_MISSING`). |
| `invoiceCustomer(order)` | The billed customer: name, the order's delivery (else pickup) address, the org number for a business booking, email. |
| `invoiceDocumentEntries(displayId, entries, { dueDays })` | The stored entries, oldest first, as the PDF's entries: number, dates, amount, paid flag and each faktura's own calculator lines (what changed since the one before). |
| `invoiceDueDate`, `invoiceFilename` | Issue date + due days; `Faktura 1042-2.pdf` / `Kreditnota 1042-K3.pdf`. |
| `buildInvoiceEmail(input)` | Subject and HTML (the shared email shell): "Faktura 1042-2 for ordre 1042" with the amount, due date, bank account and reference; a kreditnota's email says the amount is paid back. |
