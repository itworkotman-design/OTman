# `lib/orders/prepareOrdersEmailGroups.ts`

## Purpose
Decides who receives the "prepare orders" email for each selected booking-archive order, so the archive can send them all in one click.

Every pickup on an order is a separate **stop**, so an order with extra pickups is emailed once to each place it's collected from:

- **Main pickup** (`Order.customPickupAddressId`): goes to the saved address's **main user**, the user whose `User.mainPickupAddress` it is (Settings → Pickup addresses → "Main address"). The main-*return*-address link (`mainReturnAddress`, e.g. Franzefoss gjenvinning) is never used. With no main user, or no saved address, it goes to the order's store: `customerMembershipId ?? createdByMembershipId`, the same rule as the archive Store filter.
- **Extra pickup** (`Order.extraPickupContacts`): goes to the saved address's main user if it has one. Otherwise it goes to the extra pickup's own contact `email`, unless its `sendEmail` is off. It **never** falls back to the store, because the store is where the main pickup happens. With no recipient, the stop is reported as unresolved.

Main users and stores receive their login email plus a distinct membership `warehouseEmail`. If an order's main and extra pickup resolve to the same recipient, the order is still sent only once in that email.

## Exports
| Export | Description |
| --- | --- |
| `PREPARE_ORDERS_EMAIL` | Subject/message of the prepare-orders email. |
| `buildContactRecipients(name, email, warehouseEmail)` | Login email + distinct warehouse email, trimmed, empties dropped. |
| `getOrderStoreMembershipId(order)` | The order's store membership (customer membership, else creator). |
| `groupOrdersForPrepareEmail(orders, pickupContacts, storeContacts)` | Groups pickup stops into `{ key, recipientName, recipients, orderIds, stops }`. Keys are `pickup:<id>`, `store:<id>` or `email:<address>` (extra pickup's own email). Stops with no reachable email are returned in `unresolved`. |
| `buildPrepareEmailPreview(groups, unresolved, orders)` | Builds the confirmation-modal rows: one per stop with order display id, pickup address and an extra-pickup flag. Each group's `kind` is `pickup`/`store`/`extra`. |
