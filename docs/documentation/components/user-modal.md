# User Modal

## Source

- `app/_components/Dahsboard/users/UserModal.tsx`

## Responsibility

Renders the create/edit user dialog, including profile fields, role/access settings, price-list assignment, password reset actions, and membership activation toggles.

## Functions

| Function | Description |
| --- | --- |
| `UserModal` | Main user-management modal. Builds the editable form from the helper module, now captures an optional profile address with the shared address autocomplete, and sends the full user payload back through `onSave`. |
