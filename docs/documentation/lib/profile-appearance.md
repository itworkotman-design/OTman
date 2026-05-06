# Profile Appearance Helpers

## Source

- `lib/users/profileAppearance.ts`

## Responsibility

Normalizes and validates user sidebar appearance values such as uploaded logo paths and custom username colors. Supports legacy public logo paths and S3-backed user-logo paths.

## Functions

| Function | Description |
| --- | --- |
| `normalizeUsernameDisplayColor` | Accepts only six-digit hex colors for stored username display colors. |
| `normalizeUserLogoPath` | Accepts only managed public logo paths or managed S3 logo paths from the user-logo storage areas. |
| `isManagedUserLogoPath` | Returns whether a stored logo path belongs to the managed user-logo upload area. |
| `isS3UserLogoPath` | Returns whether a managed user logo is stored in S3. |
| `getUserLogoDisplayPath` | Converts an S3-backed stored logo path into the authenticated logo display endpoint and leaves legacy public paths unchanged. |
