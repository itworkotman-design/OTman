# lib/invoices/webSalesReportData.ts

`loadWebSalesReport({ companyId, month })` gathers the inputs for `buildWebSalesReport`:

- the company's `OrderPayment`s and `OrderRefund`s created in the month (Oslo time);
- the Stripe payouts (`fetchStripeSettlements`).

Order numbers fall back to the display id, and customer names to the label. When Stripe can't be reached, the report is still made without payouts and fees, and `stripeUnavailable: true` is returned.
