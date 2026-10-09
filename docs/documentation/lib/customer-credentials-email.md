# Customer Credentials Email

## Source

- `lib/customerAccounts/customerCredentialsEmail.ts`

## Responsibility

Sends the email with a customer's "My order" username and password. Used for a password reset and for staff's "Send new login". A new order's first password goes in the order-received email instead (see `send-order-received-email.md`).

- **Sent through the company Gmail**, threaded to the order like the other order emails: the order's `emailThreadToken` is reused, or created and saved. The real password sits in Gmail's Sent folder (and the `ORDER_CONVERSATION_BACKUP_EMAIL` BCC, if set).
- **Logged masked:** the copy logged on the order (`OrderEmailMessage`) has the password replaced by `••••••••••••`. It is logged under the Gmail ids, so Gmail sync skips the plaintext copy in Gmail.
- **On failure (including when the email can't be built, e.g. no `ORDER_ACTION_BASE_URL`):** the failure is logged without the error text, because that text could echo the password. A `MANUAL_REVIEW` notification asks staff to use "Send new login".

## Functions

| Function | Purpose |
|---|---|
| `buildCustomerCredentialsEmail` | Builds the subject and HTML: username, password, and a "Log in" button to `/min-bestilling/{orderNumber}`. |
| `sendCustomerCredentialsEmail` | Sends the email, logs a masked copy and an order event, and returns whether it went out. Never throws. |
