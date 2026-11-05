# lib/invoices/webSalesReportData.ts

`loadWebSalesReport({ companyId, period })` gathers the inputs for `buildWebSalesReport`:

- the company's `OrderPayment`s and `OrderRefund`s created in the period, a month or a day (Oslo time);
- the Stripe payouts (`fetchStripeSettlements`).

Order numbers fall back to the display id, and customer names to the label. When Stripe can't be reached, the report is still made without payouts and fees, and `stripeUnavailable: true` is returned.
