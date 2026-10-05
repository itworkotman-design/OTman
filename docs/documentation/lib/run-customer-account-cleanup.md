# Run Customer Account Cleanup

## Source

- `lib/customerAccounts/runCustomerAccountCleanup.ts`

## Responsibility

Backs `POST /api/cron/customer-account-cleanup`. It deletes every customer account for which `isCustomerAccountExpired` is true (see `account-lifetime.md`), including accounts left without orders. An account's sessions are deleted with it (cascade). Its orders only lose the link: `customerAccountId` is set to null.

## Functions

| Function | Purpose |
|---|---|
| `runCustomerAccountCleanup` | Runs the cleanup and returns `{ checked, deleted }`. |
