# Account Lifetime

## Source

- `lib/customerAccounts/accountLifetime.ts`

## Responsibility

Decides when a temporary customer account is deleted. The time is worked out from the account's orders and never stored.

- The account is kept while any of its orders is open or has `Order.gdprHold` set (for example an insurance case or a dispute). Closed statuses are `completed`, `cancelled`, `failed`, `invoiced` and `paid`; anything else is open.
- Otherwise it is deleted `CUSTOMER_ACCOUNT_GRACE_DAYS` (1 day) after the latest `max(statusChangedAt, updatedAt)` across its orders. `updatedAt` covers code paths that change the status without setting `statusChangedAt`. It can only make the account last longer.
- A no-show (`failed`) starts the countdown. If staff put the order back to `processing`, the order is open again and the account is kept.
- An account with no orders is due straight away.

## Functions

| Function | Purpose |
|---|---|
| `isOrderClosedForCustomer` | Says whether a status is closed for the customer. The edit policy uses it too. |
| `customerAccountDeleteAt` | Returns the delete time, or `null` if the account must be kept. |
| `isCustomerAccountExpired` | Says whether the delete time has passed. Login, sessions and the cleanup cron all use it, so an account that is due is treated as gone even before the cron deletes it. |
| `LIFETIME_ORDER_SELECT` | The order fields the rule needs, for Prisma selects. |
