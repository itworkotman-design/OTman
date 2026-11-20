# Accounting store and partner accounts

Source: `lib/integrations/accounting/companyAccounts.ts`

The company's accounts as the accounting app lists them, deactivated ones included (old orders and insurance cases still point at them). `active` is true when both the membership and the user are active.

- `loadStoreAccounts(companyId)` — accounts that book orders, by the booking form's order-creator rule (`/api/auth/order-creators`): owners/admins and users with `BOOKING_VIEW` + `BOOKING_CREATE`, never subcontractors. A–Z.
- `loadPartnerAccounts(companyId)` — `USER` accounts with subcontractor access (`BOOKING_VIEW` without `BOOKING_CREATE`), as `/api/auth/subcontractors`. A–Z.
