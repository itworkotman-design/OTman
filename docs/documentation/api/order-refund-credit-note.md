# app/api/orders/[orderId]/refunds/[refundId]/credit-note/route.ts

A Stripe refund's credit note, for website-order admins in their own company (`authorizeWebsiteOrderAdmin`).

- `GET`: the PDF as sent (from S3), or drawn again when no stored copy can be read. Use `?download=1` to download it. Returns 404 before the refund has a W-number.
- `POST`: emails it to the customer (again) via `sendRefundCreditNote({ resend: true })`. A refund with no credit note yet gets its number now. Failures return 422 with the reason.
