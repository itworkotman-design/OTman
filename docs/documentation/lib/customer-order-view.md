# Customer Order View

## Source

- `lib/customerAccounts/customerOrderView.ts`

## Responsibility

Builds a customer's own order as "My order" reads it.

- **Lookup:** orders are only found through the logged-in account (`customerAccountId` plus `orderNumber`), never by number alone.
- **What's left out:** everything internal, such as partner prices, drivers and staff notes.

## Functions

| Function | Purpose |
|---|---|
| `findCustomerOrder` | Finds the account's order by its public number, using `CUSTOMER_ORDER_SELECT`. |
| `listCustomerOrders` | Lists the account's orders, newest first, for the list page. |
| `customerOrderDetails` | Returns what the customer can edit. A white-goods order gives the full details (`kind: "catalog"`, from `editableDetailsFromOrder`), including stops and delivery. A moving or quote order gives only contact details and date (`kind: "basic"`). |
| `customerOrderTotalIncVatNok` | Returns the total to show (from `getOrderChargeAmountIncVatNok`), or `null` for a quote that hasn't been priced. |
| `customerOrderView` | Combines the order summary, the edit permissions (`getCustomerEditPermissions`) and the details. `order.rejectionNote` is the status notes only while the order is `rejected` (the reason the customer needs); otherwise it is `null`, because status notes are internal. |

`customerOrderDetails`: a `MOVING` order with stored answers is `{ kind: "moving", customer, preferredDate, timeWindow, customerType, moving: MovingEdit }`; a move without them stays `basic`.
