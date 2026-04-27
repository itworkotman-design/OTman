# Membership Enable API

## Source

- `app/api/auth/memberships/[membershipId]/enable/route.ts`

## Responsibility

Re-enables a disabled company membership from the user-management page and restores the linked user to active login status. The route never changes `passwordHash`; any legacy `disabled` password placeholders must be repaired separately.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates the actor session and admin/owner access, sets the target membership to `ACTIVE`, sets the linked user back to `ACTIVE`, leaves `passwordHash` unchanged, and logs `MEMBERSHIP_ENABLED`. |
