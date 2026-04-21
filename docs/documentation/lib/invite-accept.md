# Invite Accept Helper

## Source

- `lib/auth/inviteAccept.ts`

## Responsibility

Accepts invite tokens, creates or updates the target user, creates the company membership, and starts the new session.

## Functions

| Function | Description |
| --- | --- |
| `preferInviteValue` | Prefers a non-empty invite seed value over the existing stored user value. |
| `acceptInvite` | Validates the invite token, creates or updates the user profile, copies the optional address and sidebar appearance fields from the invite when present, creates the membership, accepts the invite, starts the session, and logs `INVITE_ACCEPTED`. |
