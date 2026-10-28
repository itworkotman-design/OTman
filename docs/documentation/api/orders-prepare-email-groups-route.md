# Orders Prepare Email Groups Route

## Source

- `app/api/orders/prepare-email-groups/route.ts`

## Responsibility

`POST { orderIds }`: for callers who can edit orders, loads the selected orders in the active company (including `pickupAddress` and `extraPickupContacts`, read with `readStoredExtraPickups`) and resolves the recipient groups for the one-click "Send prepare email to selected" button. The pickup main users come from active memberships in the company whose user's `mainPickupAddressId` matches any main or extra pickup's saved address; if several exist, the oldest wins. The store contacts come from the orders' store memberships. The grouping is done by `lib/orders/prepareOrdersEmailGroups.ts`. Returns `{ ok, groups, unresolved }`. There is one group per recipient, and an order with extra pickups can appear in several groups. It does not send anything. `PrepareEmailModal` shows the groups for confirmation and then sends each one through `POST /api/orders/send-prepare-email`.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Auth (401/409), `canEditOrders` (403), order-id validation (400), then resolves pickup/store contacts and returns the groups. |
