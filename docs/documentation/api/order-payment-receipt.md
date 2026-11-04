# app/api/orders/[orderId]/payments/[paymentId]/receipt/route.ts

A Stripe payment's receipt, for website-order admins in their own company (`authorizeWebsiteOrderAdmin`).

- `GET`: the PDF as sent (from S3), or drawn again when no stored copy can be read. Use `?download=1` to download it. Returns 404 before the payment has a receipt number.
- `POST`: emails it to the customer (again) via `sendPaymentReceipt({ resend: true })`. A payment with no receipt yet gets its number now. Failures return 422 with the reason.
