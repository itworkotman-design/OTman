# Membership Update API

## Source

- `app/api/auth/memberships/[membershipId]/update/route.ts`

## Responsibility

Updates the editable user-profile fields and membership-level permissions for an existing company membership.

## Functions

| Function | Description |
| --- | --- |
| `parseOptionalString` | Normalizes optional text input into a trimmed string or `null`. |
| `parseEmail` | Normalizes the email field into a trimmed lowercase value or `null`. |
| `parsePermissions` | Filters request permission values down to the supported booking permissions. |
| `PATCH` | Validates actor access, updates the linked user profile, refreshes membership permissions, and now saves the optional profile address together with the other profile fields. |
