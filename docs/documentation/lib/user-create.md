# User Create Helper

## Source

- `lib/auth/userCreate.ts`

## Responsibility

Creates a user and active membership directly from the dashboard when an owner or admin wants to assign a password themselves instead of sending an invite.

## Functions

| Function | Description |
| --- | --- |
| `normalizeOptionalString` | Trims optional user seed fields down to a stored value or `null`. |
| `normalizePermissions` | Filters and deduplicates supported membership permission flags while enforcing dependencies. |
| `createUserWithPassword` | Validates actor access, checks for existing accounts, hashes the provided password, creates the user and membership, stores the optional sidebar appearance fields, revokes stale pending invites for the same email, and stores membership permissions. |
