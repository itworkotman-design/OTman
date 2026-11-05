# lib/invoices/receiptPdf.ts

`renderReceiptPdf(receipt)` draws a receipt or credit note (`receiptDocument.ts`) as an A4 PDF in the faktura's style:

- seller with org.nr. MVA;
- "Kvittering" or "Kreditnota" and its W-number (also the PDF's title);
- customer;
- paid (or paid-back) date, order, the receipt a credit note credits, delivery date and payment method (card);
- the lines, continuing onto extra pages when needed;
- sum without VAT, the VAT, and a green "Betalt" / "Tilbakebetalt" total.

Negative amounts are written with a plain hyphen: nb-NO uses U+2212, which the standard fonts can't draw.
