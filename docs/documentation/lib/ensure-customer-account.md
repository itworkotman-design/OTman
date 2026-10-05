# Ensure Customer Account

## Source

- `lib/customerAccounts/ensureCustomerAccount.ts`

## Responsibility

Links an order to the customer account for its email, and creates the account if there isn't one.

- **New customer:** the account is created with a generated password.
- **Returning customer with a live account:** the order is linked and the password is kept, so a second order doesn't sign the customer out of the first.
- **Account past its delete time, or `forceNewPassword` set:** the account gets a new password and all its sessions are revoked. The first case covers an account the cron hasn't deleted yet; the second is staff using "Send new login".
- **Two orders at the same moment:** if the unique-email insert fails because another request just created the account, it uses that account.

The plaintext password is returned only when one was just set, so the caller can email it. It is never stored.

## Functions

| Function | Purpose |
|---|---|
| `ensureCustomerAccountForOrder` | Takes `{ orderId, email, forceNewPassword? }` and returns `{ accountId, email, newPassword }`, or `null` if the email isn't usable. |
| `normalizeCustomerEmail` | Trims and lowercases the email. Returns `null` unless it contains `@`. |
