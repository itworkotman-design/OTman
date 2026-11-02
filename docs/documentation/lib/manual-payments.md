# Manual Payments (ledger)

## Source

- `lib/orders/manualPayments.ts`

## Responsibility

The pure ledger behind homepage orders paid by manual faktura while Stripe isn't connected (`HOMEPAGE_PAYMENT_MODE=manual`, see `payment-mode.md`). Staff send fakturas (`OrderInvoice` rows) and mark them paid by hand; this works out what's been invoiced and paid, how the order now compares to the latest faktura, and the order's payment status (`Order.paymentStatus`: `pending` / `paid`, null before the first faktura). Amounts are what the customer pays, incl. VAT (`buildOrderStateSnapshot`, `paidOrderSnapshot.ts`).

The DB side (sending, marking paid, refreshing the status) is `lib/invoices/orderInvoices.ts`.

## Functions

| Function | Description |
| --- | --- |
| `invoiceNumber(displayId, entry)` | The faktura number is the order's ID: `1042`, then `1042-2`, `1042-3`…; a kreditnota is `1042-K<sequence>`. |
| `invoiceLedger(entries, current)` | Invoiced (fakturas − kreditnotas), paid (paid fakturas − kreditnotas), the current total, the difference, and the outcome: `none`, `invoice_pending`, `paid`, `due_more` (send another faktura), `owe_refund` (record a kreditnota). Line/detail changes are against the latest entry's snapshot. |
| `nextPaymentStatus(entries, currentTotal)` | null without fakturas; `paid` only when every faktura is marked paid **and** the total equals what was invoiced; otherwise `pending`. Any price change therefore turns a paid order pending. |
| `invoiceCalculatorLines(previous, current)` | A faktura's calculator page: every line on the first faktura, only what changed since the previous one on a follow-up (a changed line as its difference). |
| `gsmReadiness(order)` | `NOT_CONFIRMED` / `NOT_PAID` for a homepage order that isn't confirmed and paid; always `[]` for a regular order. Used by `send-to-gsm` (flags, still sends). |
| `gsmNotReadyWarning(orders)` | The confirm text the booking list shows before sending such orders to GSM; null when they're all ready. |
