# Profile Appearance Helpers

## Source

- `lib/users/profileAppearance.ts`

## Responsibility

Normalizes and validates user sidebar appearance values such as uploaded logo paths and custom username colors.

## Functions

| Function | Description |
| --- | --- |
| `normalizeUsernameDisplayColor` | Accepts only six-digit hex colors for stored username display colors. |
| `normalizeUserLogoPath` | Accepts only managed public logo paths from the `/uploads/user-logos/` storage area. |
| `isManagedUserLogoPath` | Returns whether a stored logo path belongs to the managed user-logo upload area. |
