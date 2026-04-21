# User Types

## Source

- `lib/users/types.ts`

## Responsibility

Defines the shared user, membership, and option types used by the dashboard user-management and booking flows.

## Functions

This file exports types only.

## Type Notes

- `MembershipUser` now includes the optional saved profile address and the optional sidebar appearance fields.
- `UserOption` can now carry an optional address so booking flows can autofill pickup and return addresses from the selected customer profile.
