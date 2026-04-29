# Order Creators API

## Source

- `app/api/auth/order-creators/route.ts`

## Responsibility

Returns the active company memberships that can act as stores or order creators in the booking UI, while excluding disabled users and subcontractor-only users.

## Functions

| Function | Description |
| --- | --- |
| `getMembershipName` | Chooses the display name for one membership by preferring username over email. |
| `GET` | Filters active company memberships down to every active non-subcontractor user, so standard order creators and legacy WordPress-mapped store users both appear in archive filters, selection bars, and the order modal, then returns option objects with id, name, primary email, warehouse email, and the optional saved address used for booking-address autofill. |
