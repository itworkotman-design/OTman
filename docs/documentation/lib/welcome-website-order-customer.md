# Welcome Website Order Customer

## Source

- `lib/customerAccounts/welcomeWebsiteOrderCustomer.ts`

## Responsibility

Every homepage order route (`white-goods-order`, `moving-request`, `special-goods-quote`) calls this right after saving the order, passing the saved order row (`WelcomeOrder`). It:

1. Links the order to the customer's account with `ensureCustomerAccountForOrder`, creating it if needed.
2. Sends the ONE order-received email through `sendOrderReceivedEmail`, with:
   - `customerLogin`: the username, plus the password if one was just generated (otherwise `null`);
   - `orderDetails`: built from the order row. `totalIncVatNok` comes from `getOrderChargeAmountIncVatNok`, and is `null` for an unpriced quote.

There is no separate password email any more. It never throws: if the account can't be created, the email still goes out without the login block, and staff get a `MANUAL_REVIEW` notification.
