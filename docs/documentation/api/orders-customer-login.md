# POST /api/orders/[orderId]/customer-login

## Source

- `app/api/orders/[orderId]/customer-login/route.ts`

## Responsibility

Backs the "Send new login" button in the admin `WebsiteOrderModal`. It emails the order's customer a new "My order" password. It uses `ensureCustomerAccountForOrder` with `forceNewPassword`, so:

- an account that was already deleted is recreated (for example, a no-show calling back days later)
- the order is moved to the account for its current email, if staff corrected the email

Access is the same as the website-order editor: company OWNER or ADMIN, or Website orders at ADMIN level. Only website orders in the active company are found.

| Result | Meaning |
|---|---|
| `{ ok: true, email }` | The new login was sent. |
| `409 MISSING_CUSTOMER_EMAIL` | The order has no usable email. |
| `502 EMAIL_FAILED` | The account was updated, but the email failed. The failure is logged on the order. |
