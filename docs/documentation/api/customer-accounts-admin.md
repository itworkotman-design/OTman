# Website users API (staff)

## Source

- `app/api/auth/customer-accounts/route.ts`
- `app/api/auth/customer-accounts/[accountId]/route.ts`
- `lib/customerAccounts/requireWebsiteUsersAdmin.ts`
- `lib/customerAccounts/adminCustomerAccounts.ts`

## Responsibility

Backs the **Website users** tab in user management: staff managing the temporary "My order" logins (`CustomerAccount`) of their homepage customers.

**Access:** `requireWebsiteUsersAdmin`. It allows the company OWNER, or a member with USER_MANAGEMENT at ADMIN level (`isUserManagementAdmin`), and returns the active company plus the audit actor.

**Company scope:** an account belongs to a company when it has orders there.
- **Listing** shows the company's live accounts, meaning those not past their delete time (`accountLifetime.ts`), with only that company's orders.
- **Changes** are refused with `409 SHARED_ACCOUNT` when the account also has another company's orders, so one company can never take over another's customer.
- An account without orders in the company is `404 NOT_FOUND`.

| Method | Body | Does |
|---|---|---|
| `GET /api/auth/customer-accounts` | — | `{ accounts }`: id, email, createdAt, lastLoginAt, activeSessions, deleteAt (null = kept while an order is open), sharedWithOtherCompany, and the company's orders (number, status, delivery date). |
| `PATCH …/[accountId]` | `{ action: "setPassword", password }` | Sets it (min. 8 characters, otherwise `422 PASSWORD_TOO_SHORT`) and signs the account out everywhere. Not emailed. |
| | `{ action: "sendNewPassword" }` | Generates a password, signs out, and emails it on the newest order (`sendCustomerCredentialsEmail`, through Gmail). `502 EMAIL_FAILED` if the email fails (the password is changed by then). |
| | `{ action: "changeEmail", email }` | Changes the login email (normalized) and the email on the account's orders in this company. `422 INVALID_EMAIL`, or `409 EMAIL_TAKEN` when another login uses it. |
| | `{ action: "signOut" }` | Revokes all its sessions. |
| `DELETE …/[accountId]` | — | Deletes the login. Sessions go with it, and the orders stay but lose the link. "Send new login" on an order creates a new one. |

Every change is logged as an order action event on each of the account's orders, with the staff member as the actor. A password is never logged.
