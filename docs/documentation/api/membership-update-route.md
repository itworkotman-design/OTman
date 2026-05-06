# Membership Update API

## Source

- `app/api/auth/memberships/[membershipId]/update/route.ts`

## Responsibility

Updates the editable user-profile fields and membership-level permissions for an existing company membership. Replaced managed logos are cleaned up from either legacy public storage or S3 storage.

## Functions

| Function | Description |
| --- | --- |
| `parseOptionalString` | Normalizes optional text input into a trimmed string or `null`. |
| `parseEmail` | Normalizes the email field into a trimmed lowercase value or `null`. |
| `parsePermissions` | Filters request permission values down to the supported booking permissions. |
| `PATCH` | Validates actor access, updates the linked user profile, refreshes membership permissions, saves the optional profile address together with the other profile fields, replaces or clears the optional sidebar logo and username display color, and removes the previous managed logo from local disk or S3 when it changes. |
