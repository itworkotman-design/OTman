# User Modal Helpers

## Source

- `lib/users/userModal.ts`

## Responsibility

Defines the user-modal form shape and the small helper functions that build, derive, and update modal state.

## Functions

| Function | Description |
| --- | --- |
| `buildInitialForm` | Creates the modal form state from the provided initial values, including the optional address field. |
| `getPermissions` | Derives whether the actor can edit the current target and whether active-state controls should be shown. |
| `getSaveButtonLabel` | Returns the modal primary-button label for create and edit modes. |
| `makeFieldUpdater` | Builds text-field change handlers for the shared modal form state. |
| `makeSelectUpdater` | Builds select change handlers for role and price-list fields. |
| `getAccessTypeFromPermissions` | Maps granular booking permissions into the simplified access dropdown value. |
| `getPermissionsFromAccessType` | Expands the simplified access dropdown value back into concrete permission flags. |
