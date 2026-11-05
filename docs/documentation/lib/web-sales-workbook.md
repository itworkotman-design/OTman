# lib/invoices/webSalesWorkbook.ts

`buildWebSalesWorkbook(report, { createdAt, stripeUnavailable? })` writes the web-sales report as an Excel file, in Norwegian:

- **Sammendrag**: the totals the voucher is posted from (sales, refunds and net, incl./ex. VAT and VAT), plus payouts to the bank, Stripe fees, and what wasn't paid out yet. It warns when Stripe couldn't be reached.
- **Bilag**: every receipt and credit note, with its amounts, the receipt it credits, the Stripe reference, payout, payout date and fee. Rows not yet paid out are marked "Ikke utbetalt".
- **Utbetalinger**: Stripe's payouts that reached the bank in the period.

`webSalesReportFilename(period, format?)`: `Nettsalg W-serie <period>.xlsx` (or `.pdf`).
