# Order Creators API

## Source

- `app/api/auth/order-creators/route.ts`

## Responsibility

Returns the company memberships that can act as stores or order creators in the booking UI, while excluding subcontractor-only users.

## Functions

| Function | Description |
| --- | --- |
| `getMembershipName` | Chooses the display name for one membership by preferring username over email. |
| `GET` | Filters company memberships down to every non-subcontractor user, so standard order creators and legacy WordPress-mapped store users both appear in archive filters, selection bars, and the order modal, then returns option objects with id, name, email, and the optional saved address used for booking-address autofill. |
