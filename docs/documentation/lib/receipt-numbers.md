# lib/invoices/receiptNumbers.ts

The web-sales sales-document series (W-<n>), shared by Stripe payment receipts and refund credit notes. It's kept apart from PowerOffice's own invoice numbers and reported to the accountant monthly (`webSalesReport.ts`).

- `allocateReceiptNumber({ orderPaymentId } | { orderRefundId })`: the document's number. That's the one it already has, otherwise the next in the series. The number is written on `OrderPayment.receiptNumber` / `OrderRefund.receiptNumber`.
  - The `ReceiptNumber` table is the series. The number is its primary key, so a race can't give one number twice (the loser takes the next one). Each document id is unique, so a document never gets two numbers.
  - A number is only taken together with its document, so the series has no gaps.
- Re-exports `formatReceiptNumber` / `RECEIPT_SERIES_PREFIX` from `receiptSeries.ts`.
