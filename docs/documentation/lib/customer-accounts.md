# Customer Accounts ("My order")

Overview of `lib/customerAccounts/`, the temporary logins homepage customers get with their order. Each file has its own doc, listed below.

- When a homepage order is created, the customer gets an account. The username is their email; the password is a generated 12-character one, sent in its own email via Brevo.
- They log in at `/{locale}/min-bestilling` to see and change their order (`app/api/customer/*`).
- The account is separate from the dashboard's `User`/`Session` and has its own cookie, `csid`, so it can never reach the dashboard.
- The `customer-account-cleanup` cron deletes it one day after its last order closes, unless an order has `gdprHold` set (see `account-lifetime.md`).
- Staff can always send a fresh login from the website order modal ("Send new login").

| File | Doc |
|---|---|
| `generatedPassword.ts` | `generated-password.md` |
| `accountLifetime.ts` | `account-lifetime.md` |
| `ensureCustomerAccount.ts` | `ensure-customer-account.md` |
| `customerSession.ts` | `customer-session.md` |
| `serverCustomerSession.ts` | `server-customer-session.md` |
| `customerLogin.ts` | `customer-login.md` |
| `customerCredentialsEmail.ts` | `customer-credentials-email.md` |
| `welcomeWebsiteOrderCustomer.ts` | `welcome-website-order-customer.md` |
| `customerOrderView.ts` | `customer-order-view.md` |
| `runCustomerAccountCleanup.ts` | `run-customer-account-cleanup.md` |
| `requestIp.ts` | `request-ip.md` |
