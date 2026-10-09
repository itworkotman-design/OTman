# User Management Page

## Source

- `app/(User)/dashboard/users/page.tsx`

## Responsibility

Loads company memberships for the dashboard user-management screen, opens the shared user modal for create and edit actions, filters the visible table with normalized text search, sends direct-create, invite, or update requests back to the auth APIs, and keeps the controls plus wide membership table centered inside the same `max-w-1800` container and the same table-width horizontal scroll frame so the action buttons align with the table edge.

## Functions

| Function | Description |
| --- | --- |
| `getRoleRowClass` | Returns the row color class for each membership role. |
| `UserPage` | Main dashboard page. Loads memberships, price lists, and presence data, pauses background membership refresh while the modal is open, uploads optional user logos before save, passes a stable modal reset key into the user modal, keeps the local search input out of browser autofill, normalizes local table search so case and spaces do not affect matches, routes create-mode submissions to either the direct-create API or the invite API, and renders controls and the table inside one centered `max-w-1800` scroll area with a shared table-width inner frame. |

## Tabs

- **Users**: the company's staff memberships (everyone with User management).
- **Apps & roles** (`AppsRolesTab`): user-management admins only.
- **Website users** (`app/_components/Dahsboard/users/WebsiteUsersTab.tsx`): user-management admins only (owner, or User management at ADMIN). The temporary "My order" logins of the company's homepage customers, from `GET /api/auth/customer-accounts` (see `docs/documentation/api/customer-accounts-admin.md`).
  - The table shows email, the orders with their status, created, last login, how many devices are signed in, and when the login will be deleted ("While an order is open" until all its orders are closed). It can be searched by email or order number.
  - **Manage** opens a side panel:
    - **Change email:** also changes the email on the customer's orders here.
    - **Email a new password:** generated and emailed.
    - **Set a password:** typed in by the admin, at least 8 characters, and not emailed.
    - **Sign out everywhere.**
    - **Delete login:** with a confirm. The orders stay.
  - A login that also has another company's orders is marked "Shared" and can't be changed.
