# lib/invoices/webSalesReport.ts

The monthly web-sales report for the accountant. The W-series is posted to PowerOffice as one voucher a month, and the Stripe clearing account is reconciled against the payouts. Pure.

- `parseReportPeriod({ month } | { date })`: a month (`YYYY-MM`) or a single day (`YYYY-MM-DD`) as Oslo midnights (`label`, `from`, `to` exclusive), or null.
- `buildWebSalesReport({ period, payments, refunds, stripe })`:
  - `rows`: every receipt (positive) and credit note (negative), ordered by number. Each row has the VAT split as on the document (25 % of the amount, rounded per document), the receipt a credit note credits, the Stripe reference, and the payout and fee from the lookup. A payment without a number shows "Mangler nummer".
  - `notPaidOut`: the rows Stripe hadn't paid out yet.
  - `payouts`: the payouts that reached the bank in the period.
  - `totals`: sales, refunds, net (incl./ex. VAT, VAT), fees, not paid out, payouts.

Loaded by `webSalesReportData.ts`. Written as Excel by `webSalesWorkbook.ts` and as PDF by `webSalesReportPdf.ts`.
