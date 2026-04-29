# User Modal Helpers

## Source

- `lib/users/userModal.ts`

## Responsibility

Defines the user-modal prop and form shape plus the small helper functions that build, derive, and update modal state for both direct-password and invite-based user creation, including the optional `warehouseEmail` field.

## Functions

| Function | Description |
| --- | --- |
| `buildInitialForm` | Creates the modal form state from the provided initial values, including the optional warehouse email, address field, sidebar appearance fields, default direct-create mode, and empty password fields. |
| `getPermissions` | Derives whether the actor can edit the current target and whether active-state controls should be shown. |
| `getSaveButtonLabel` | Returns the modal primary-button label for direct create, invite create, and edit modes. |
| `makeFieldUpdater` | Builds text-field change handlers for the shared modal form state, including password fields. |
| `makeSelectUpdater` | Builds select change handlers for role, price list, and create-mode setup fields. |
| `getAccessTypeFromPermissions` | Maps granular booking permissions into the simplified access dropdown value. |
| `getPermissionsFromAccessType` | Expands the simplified access dropdown value back into concrete permission flags. |
