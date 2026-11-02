# Order Invoices Routes

## Source

- `app/api/orders/[orderId]/invoices/route.ts`
- `app/api/orders/[orderId]/invoices/mark-paid/route.ts`
- `app/api/orders/[orderId]/invoices/[invoiceId]/pdf/route.ts`

## Responsibility

A homepage order's manual fakturas (`lib/invoices/orderInvoices.ts`). All are for website-order admins only (`authorizeWebsiteOrderAdmin`: company owner/admin, or Website orders at ADMIN level).

| Route | Description |
| --- | --- |
| `GET /api/orders/[orderId]/invoices` | `{ ok, invoices, ledger, paymentStatus }` (`getOrderInvoiceOverview`) — the Payment card and the Alert Center's Payment tab. |
| `POST /api/orders/[orderId]/invoices` | Body `{ kind: "invoice" \| "refund", amountCents }`: send a faktura for what's owed beyond what's been invoiced, or record (and email) a kreditnota for what was overpaid. `amountCents` is what the admin's button showed; if the order changed since, nothing is sent and `409 AMOUNT_CHANGED` returns the current amount. Other refusals: `404 ORDER_NOT_FOUND`, `409 NOTHING_TO_INVOICE / NOTHING_TO_REFUND / INVOICE_IN_PROGRESS`, `422 MISSING_CUSTOMER_EMAIL`, `500 INVOICE_SETTINGS_MISSING`, `502 INVOICE_SEND_FAILED`. |
| `POST /api/orders/[orderId]/invoices/mark-paid` | Marks every unpaid faktura paid — the only way an order's payment status becomes `paid`. `409 NOTHING_TO_MARK_PAID`. |
| `GET /api/orders/[orderId]/invoices/[invoiceId]/pdf` | The faktura's PDF exactly as it was sent (from S3), `inline` for View, `attachment` with `?download=1`. 404 when there's no stored file. |
