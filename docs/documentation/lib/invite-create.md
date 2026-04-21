# Invite Create Helper

## Source

- `lib/auth/inviteCreate.ts`

## Responsibility

Creates a pending invite record, stores its seeded profile values, sends the invite email, and logs the auth event.

## Functions

| Function | Description |
| --- | --- |
| `normalizeOptionalString` | Trims optional invite seed fields down to a stored value or `null`. |
| `normalizePermissions` | Filters and deduplicates supported invite permission flags while enforcing dependencies. |
| `createInvite` | Validates actor access, revokes prior pending invites for the same email, creates a new invite, saves the optional address and sidebar appearance fields with the rest of the seeded profile data, delivers the invite, and logs `INVITE_SENT`. |
