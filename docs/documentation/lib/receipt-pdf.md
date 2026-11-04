# lib/invoices/receiptPdf.ts

`renderReceiptPdf(receipt)` draws an A4 PDF in the faktura's style:

- seller with org.nr. MVA;
- "Kvittering" and its number;
- customer;
- paid date, order, delivery date and payment method (card);
- the lines, continuing onto extra pages when needed;
- sum without VAT, the VAT, and a green "Betalt" total.
