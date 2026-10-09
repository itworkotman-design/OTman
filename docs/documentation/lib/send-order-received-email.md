# `lib/orders/sendOrderReceivedEmail.ts`

## Responsibility
The ONE "we received your order" email, sent right after a customer submits a
homepage order. `app/api/site/white-goods-order`, `moving-request` and
`special-goods-quote` call it through `welcomeWebsiteOrderCustomer` once the
order row is saved; that helper links the customer's "My order" account and
passes `customerLogin` (username + the new password, or `null` for a returning
customer) and `orderDetails`. (Not wired into `/tjenester` manpower or the dead
`transport-request` route.)

## Functions
- `sendOrderReceivedEmail(order)` — never throws (the order is already saved),
  but the customer must never be silently left without it: any failure (send
  error, or no email on the order) raises a `MANUAL_REVIEW` staff notification
  ("Order-received email NOT sent") and records a FAILED `OrderEmailMessage`.
  - It is an `order_received` lifecycle email through the company Gmail
    (`sendLifecycleEmailsForOrders`, actor `SYSTEM`/"Website"), threaded to
    the order like every other order email. With a new password in it, the
    copy logged on the order (`OrderEmailMessage`) has the password masked —
    logged under the Gmail ids, so Gmail sync skips the plaintext copy — and a
    failure is logged/alerted without the error text (it could echo the
    password). The real password is in Gmail's Sent folder (and the
    `ORDER_CONVERSATION_BACKUP_EMAIL` BCC, if set).
  - Staff can resend the kind through `app/api/orders/send-lifecycle-email`
    (no dashboard button yet; a resend has no login or details table).

## The email (`buildOrderReceivedEmail` in `customerLifecycleEmails.ts`)
Norwegian, in this order:
1. Thanks + "we have received order #X and are processing it".
2. With `customerLogin`: what My order is for, username, password (or "use the
   password you already have" + forgot-password link), a "Gå til Min
   bestilling" button, that the login is deleted after delivery and must not
   be shared, and the edit rules — until the cutoff (24h before the time
   window starts, `getEditCutoff`, written as e.g. "onsdag 14. oktober kl.
   10:00") date, addresses and products can be changed and the order
   cancelled; after it, services can still be added and contact info updated,
   and cancelling becomes a request to staff.
3. "Questions or changes? Just reply to this email."
4. With `orderDetails`: a "Bestillingsdetaljer" table (same look as the
   dashboard's send-selected-orders email): date + time window, pickup, extra
   pickups, delivery address, floor/lift, return address, products, delivery
   type, services (translated with `website-line-labels`), name, phone, email,
   comment and total incl. VAT. Empty rows are left out; an unpriced quote has
   no total.

## Notes
- No token action links (pay / cancel / request change): the email goes out
  once the order is placed (later: once Stripe payment succeeds); no
  `actionToken` exists yet.
- The `order_updated` kind (`buildOrderUpdatedEmail`) is the customer's record
  of a change they made in My order. Only the customer edit route sends it, so
  it is left out of `LIFECYCLE_EMAIL_KINDS`.
- The customer-facing number is `Order.orderNumber` (see
  `public-order-number.md`), not the internal `displayId`.
- `customerCredentialsEmail.ts` is still used on its own for a password reset
  and staff's "Send new login".
