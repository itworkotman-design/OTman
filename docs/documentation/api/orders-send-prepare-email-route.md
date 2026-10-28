# Orders Send Prepare Email Route

## Source

- `app/api/orders/send-prepare-email/route.ts`

## Responsibility

`POST { orderIds, recipients, recipientName }`: sends one "prepare orders" email (one group from `prepare-email-groups`) through **Gmail**, using the configured send-as address. Called by `PrepareEmailModal`, once per group. The subject and message are fixed server-side (`PREPARE_ORDERS_EMAIL`), and the body is built by `buildSelectedOrdersEmailHtml`.

It is deliberately kept **out of the order email conversation**:

- No reply token, Reply-To or Gmail thread. Replies stay in the Gmail inbox.
- No `OrderEmailMessage` row. The Alert Center treats any message as "a conversation exists": it prefills the default recipient from the last outbound message, adds "Re:" to the next subject, and skips the store's first-message notification. Gmail sync can also match replies through a stored message.
- `lastOutboundEmailAt` is never set. That field drives the order creators' (stores') "unread" highlight.

On success, every order gets `Order.prepareEmailSentAt` (the violet middle segment of the alerts-column marker strip) and a History action event, "Order sent for Forbered bestillinger" with the recipients. On a Gmail failure nothing is written and the route returns 502 with the reason, which the modal shows. It is blocked with 409 when the company's order emails are disabled.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Auth (401/409), `canEditOrders` (403), order emails enabled (409), payload validation (400), company-scoped orders (404 if none). Sends via Gmail, then sets `prepareEmailSentAt` and writes History events. |
