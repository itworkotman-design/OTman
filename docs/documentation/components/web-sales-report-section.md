# app/_components/Dahsboard/home/WebSalesReportSection.tsx

A Dashboard Home card ("Report for accounting"), placed above GDPR. It downloads the web-sales report (`/api/orders/web-sales-report`) as Excel or PDF.

- Uses `PeriodPicker`, which opens on the month view and switches to a single day with "Day". It defaults to last month (Oslo time).
- Two buttons, "Download Excel" and "Download PDF". The file is named `Nettsalg W-serie <period>.xlsx|pdf`.
- Shown to website-order admins (`isWebsiteOrdersAdmin`: owner/admin, or Website orders at ADMIN), the same rule as the API.
