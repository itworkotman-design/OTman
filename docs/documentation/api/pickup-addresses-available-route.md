# Pickup Addresses Available Route

## Source

- `app/api/pickup-addresses/available/route.ts`

## Responsibility

`GET`: the caller's usable active custom pickup addresses. Full-access (Owner/Admin) callers get every active address; everyone else gets only the addresses assigned to them. Order creation and the booking archive Pickup filter both read from this route.

`?fromDate=&toDate=` (optional, `YYYY-MM-DD`): only addresses that the active company's orders in that delivery-date range use as their pickup. The booking archive passes the applied date filter so the Pickup filter only lists that range's pickups, like the Store filter.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Auth (401/409), optional date-range filter, access-scoped address list. |
