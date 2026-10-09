# Customer Order Edit Policy

## Source

- `lib/orders/customerOrderEditPolicy.ts`

## Responsibility

Decides what a customer may change on their own order in "My order", and when. The server (`app/api/customer/orders/[orderNumber]`) checks every request against these rules. The locked sections on the page are only a convenience.

| Change | When it is allowed |
|---|---|
| Contact info, notes, delivery type and add-ons on products already in the order | Whenever the order is open |
| Date and time window, addresses/floors/lift, adding or removing a product, quantity | Until 24 hours before the time window starts |
| Any change to products or addresses | Only on white-goods (catalog) orders |

The cutoff is 24 hours before the time window starts, in **Oslo time**. The start is the from-time of a preset or custom window on `deliveryDate`; a free-text or missing window counts as 00:00. An order with no date has no cutoff.

## Functions

| Function | Purpose |
|---|---|
| `getEditCutoff` | Returns the cutoff time, or `null`. |
| `getCustomerEditPermissions` | Returns `{ open, beforeCutoff, cutoffAt, canEditItems }`. |
| `isBookableDeliveryDate` | The booking calendar's day rule on its own: from tomorrow (Oslo), not a Sunday or a Norwegian public holiday. New homepage orders are held to it on the server. |
| `isAllowedNewSchedule` | Checks a new date and time window. The date must follow the booking calendar's rules: from tomorrow, and not a Sunday or a Norwegian public holiday. The new slot's own cutoff must still be in the future. |
| `classifyCustomerOrderEdit` | Lists which kinds of change a request makes: `contact`, `notes`, `schedule`, `addresses`, `addOns` (a product only gets services added: lists grow, a return or dismantling is switched on, doorstep → carry-in), `reconfigure` (any other change to a product's setup), `addProduct`, `removeProduct`, `quantity`. A pickup stop's contact person counts as contact, and product names on stops are ignored. Parts the request leaves out aren't compared. |
| `findForbiddenChanges` | Returns the kinds of change the permissions don't allow. After the 24h cutoff only `contact`, `notes` and `addOns` are allowed, so removing or downgrading a service is refused (`EDIT_NOT_ALLOWED`). |
