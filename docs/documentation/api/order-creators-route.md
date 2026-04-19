# Order Creators API

## Source

- `app/api/auth/order-creators/route.ts`

## Responsibility

Returns the active memberships that can act as order creators or customers in the booking UI.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Filters active memberships down to users with order-creator access and returns option objects with id, label, email, and the optional saved address used for booking-address autofill. |
