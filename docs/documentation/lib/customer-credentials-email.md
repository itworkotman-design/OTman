# Customer Credentials Email

## Source

- `lib/customerAccounts/customerCredentialsEmail.ts`

## Responsibility

Sends the email with a customer's "My order" username and password.

- **Sent through Brevo:** not through the company Gmail account the other order emails use. A password sent from Gmail would sit in plaintext in Gmail's Sent folder and in the order's Email Center.
- **Logged masked:** the copy logged on the order (`OrderEmailMessage`) has the password replaced by `••••••••••••`.
- **On failure:** the failure is logged without the error text, because that text could echo the password. A `MANUAL_REVIEW` notification asks staff to use "Send new login".

## Functions

| Function | Purpose |
|---|---|
| `buildCustomerCredentialsEmail` | Builds the subject and HTML: username, password, and a "Log in" button to `/min-bestilling/{orderNumber}`. |
| `sendCustomerCredentialsEmail` | Sends the email, logs a masked copy and an order event, and returns whether it went out. Never throws. |
