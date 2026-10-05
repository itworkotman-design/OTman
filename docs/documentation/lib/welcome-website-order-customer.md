# Welcome Website Order Customer

## Source

- `lib/customerAccounts/welcomeWebsiteOrderCustomer.ts`

## Responsibility

Every homepage order route (`white-goods-order`, `moving-request`, `special-goods-quote`) calls this right after saving the order. It replaces the direct call to `sendOrderReceivedEmail`. It runs three steps:

1. `ensureCustomerAccountForOrder` links the order to the customer's account, creating the account if needed.
2. `sendOrderReceivedEmail` is called with `customerLogin`, so the email includes the My order button and the username.
3. If a password was just set, `sendCustomerCredentialsEmail` sends it.

It never throws. If the account can't be created, the order email still goes out without the login block, and staff get a `MANUAL_REVIEW` notification.
