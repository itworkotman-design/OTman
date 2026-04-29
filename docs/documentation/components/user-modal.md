# User Modal

## Source

- `app/_components/Dahsboard/users/UserModal.tsx`

## Responsibility

Renders the create/edit user dialog, including profile fields, the optional `warehouseEmail` alongside the primary email and address fields, role/access settings, price-list assignment, direct-password or invite-based setup for new users, profile logo upload, username color selection, password reset actions, and membership activation toggles.

## Functions

| Function | Description |
| --- | --- |
| `UserModal` | Main user-management modal. Builds the editable form from the helper module, resets only when a new modal session starts, lets create mode switch between direct password setup and the invite flow, captures the optional warehouse email and profile address, manages the optional logo and username color inputs, and sends the full user payload back through `onSave`. |
