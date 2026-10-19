# Paid Order Change

## Source

- `lib/customerAccounts/paidOrderChange.ts`

## Responsibility

The rule for a customer's own "My order" change once the order has been paid
(net of refunds):

| Change | Before the 24h cutoff | Within 24h |
| --- | --- | --- |
| Dearer | Paid first (`payFirst`, the new total minus what's paid) | Paid first |
| Cheaper | Saved; a `confirmed` order goes back to `processing` (`reopen`), refunded when staff confirm it | Refused (`WOULD_DECREASE_PRICE`) — only additions |
| Same price | Saved | Saved |

An unpaid order always just saves. In mode `"paid"` (applying a change already
paid for) a dearer change saves.

## Functions

| Function | Description |
| --- | --- |
| `decidePaidOrderChange` | Pure: `{ action: "save", reopen } \| { action: "payFirst", amountDueCents } \| { action: "reject", reason }`. |
