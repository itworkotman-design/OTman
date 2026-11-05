# app/api/orders/web-sales-report/route.ts

`GET ?month=YYYY-MM`: the monthly web-sales report (`lib/invoices/webSalesReport.ts`) for the active company as an Excel download (`Nettsalg W-serie YYYY-MM.xlsx`). Website-order admins only (`authorizeWebsiteOrderAdmin`). An invalid month returns 400 `INVALID_MONTH`.
