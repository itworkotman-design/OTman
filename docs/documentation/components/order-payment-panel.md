# Order Payment Panel

## Source

- `app/_components/Dahsboard/booking/archive/OrderPaymentPanel.tsx`

## Responsibility

The Alert Center's **Payment** tab (`OrderEmailModal`), shown for homepage orders only, laid out like the SMS tab.

- A summary: payment badge, invoiced, paid, the order total now and the difference (incl. VAT).
- Every faktura and kreditnota, newest first: number, Paid/Pending (or "Owed back"), when it was sent and by whom ("the website (automatic)" for the faktura at booking), due date, when and by whom it was marked paid, and the order total it brought the order to.
- **View** opens the faktura's PDF inside the tab, exactly as the customer received it (the stored file, BETALT stamps as they were then); **Download** saves it. Both use `GET /api/orders/[orderId]/invoices/[invoiceId]/pdf`.

Fakturas are sent and marked paid from the order's Payment card (`WebsiteOrderInvoiceSummary`), not here.
