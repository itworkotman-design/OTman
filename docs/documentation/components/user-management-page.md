# User Management Page

## Source

- `app/(User)/dashboard/users/page.tsx`

## Responsibility

Loads company memberships for the dashboard user-management screen, opens the shared user modal for create and edit actions, and sends invite or update requests back to the auth APIs.

## Functions

| Function | Description |
| --- | --- |
| `getRoleRowClass` | Returns the row color class for each membership role. |
| `UserPage` | Main dashboard page. Loads memberships, price lists, and presence data, now passes the optional address field into the user modal, and includes saved addresses in the local search filter. |
