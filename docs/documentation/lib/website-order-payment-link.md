# Website order payment link

## Source

- `lib/orders/websiteOrderPaymentLink.ts`

## Responsibility

`planWebsiteOrderPaymentLink({ status, email, remainingBalanceIncVatNok })` maps "Save & send payment link" in the admin product editor to an existing customer email:

| Status | Result |
|---|---|
| none / `processing` / `rejected` | approve, then `payment_request` |
| `approved` / `failed` | `payment_request` again |
| `confirmed` with a balance left | `balance_due` |
| `confirmed` and fully paid | `NOTHING_TO_PAY` |
| anything else | `NOT_PAYABLE_STATUS` |

`MISSING_CUSTOMER_EMAIL` takes precedence. The pay page (`/betaling/[token]`) always charges the current total or remaining balance, so a re-sent link is never stale.
