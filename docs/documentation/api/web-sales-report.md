# app/api/orders/web-sales-report/route.ts

`GET ?month=YYYY-MM` or `?date=YYYY-MM-DD`, plus `&format=pdf` for a PDF (Excel otherwise). Returns the web-sales report (`lib/invoices/webSalesReport.ts`) for the active company as a download named `Nettsalg W-serie <period>.xlsx|pdf`.

Website-order admins only (`authorizeWebsiteOrderAdmin`). An invalid period returns 400 `INVALID_PERIOD`.
