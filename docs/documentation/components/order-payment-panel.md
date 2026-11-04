# Order Payment Panel

## Source

- `app/_components/Dahsboard/booking/archive/OrderPaymentPanel.tsx`

## Responsibility

The Alert Center's **Payment** tab (`OrderEmailModal`), shown for homepage orders only, laid out like the SMS tab.

- A summary: payment badge, invoiced, paid, the order total now and the difference (incl. VAT).
- Every faktura and kreditnota, newest first: number, Paid/Pending (or "Owed back"), when it was sent and by whom ("the website (automatic)" for the faktura at booking), due date, when and by whom it was marked paid, and the order total it brought the order to.
- **View** opens the faktura's PDF inside the tab, exactly as the customer received it (the stored file, BETALT stamps as they were then); **Download** saves it. Both use `GET /api/orders/[orderId]/invoices/[invoiceId]/pdf`.

Fakturas are sent and marked paid from the order's Payment card (`WebsiteOrderInvoiceSummary`), not here.

## Stripe payments (`HOMEPAGE_PAYMENT_MODE=stripe`)
The tab first asks `GET /api/orders/[orderId]/payments` (`app/api/orders/[orderId]/payments/route.ts`). With manual payments that answers only `paymentMode: "manual"`, and the faktura view above (`InvoicePaymentPanel`) is shown. With Stripe it shows `StripePaymentPanel` instead:
- paid so far (refunds deducted), the order total now and the difference, with a Paid / Payment pending badge;
- every Stripe charge, newest first: "Paid at booking" (the first) or "Additional payment" (a paid "My order" change or a top-up), with its date, payment intent id and any refunds under it.

The data comes from `lib/orders/stripePaymentOverview.ts` (`getOrderStripePaymentOverview` / `buildStripePaymentOverview`, over the `OrderPayment` ledger and `compareOrderWithPayments`).

Each payment shows its receipt row (`PaymentReceiptRow`): number, when it was emailed, View / Download, and Send receipt / Send again (`/api/orders/[orderId]/payments/[paymentId]/receipt`).
