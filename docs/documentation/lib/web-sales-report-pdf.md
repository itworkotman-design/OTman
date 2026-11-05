# lib/invoices/webSalesReportPdf.ts

`renderWebSalesReportPdf(report, { createdAt, stripeUnavailable? })` draws the web-sales report as a landscape A4 PDF with the same content as the Excel file (`webSalesWorkbook.ts`):

- the summary: sales, refunds and net (incl./ex. VAT, VAT), payouts, fees, and what wasn't paid out yet;
- every receipt and credit note;
- Stripe's payouts to the bank.

Tables continue on new pages with their headers repeated. It warns when Stripe couldn't be reached. The PDF title is `Nettsalg W-serie <period>`.
