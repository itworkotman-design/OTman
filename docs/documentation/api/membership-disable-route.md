# Membership Disable API

## Source

- `app/api/auth/memberships/[membershipId]/disable/route.ts`

## Responsibility

Disables an active company membership from the user-management page and also marks the linked user as disabled so login/session checks block access.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates the actor session and admin/owner access, prevents self-disable and last-owner disable, sets the target membership to `DISABLED`, sets the linked user to `DISABLED`, and logs `MEMBERSHIP_DISABLED`. |
