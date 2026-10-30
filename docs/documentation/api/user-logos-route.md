# User Logos List API

## Source

- `app/api/auth/users/logos/route.ts`

## Responsibility

Lists the distinct managed profile pictures (`User.logoPath`) currently used by members of the active company, most recently updated first. Backs the "Previously used pictures" picker in `UserModal`, so the same logo file can be assigned to several users without re-uploading it. Requires the `USER_MANAGEMENT` module to be enabled (Viewer or Admin); actually saving a picked logo still goes through the admin-gated create/invite/update routes.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Validates the session, active company and `USER_MANAGEMENT` access, then returns `{ ok, logos: [{ logoPath, displayPath }] }` — non-managed paths are filtered out, and `displayPath` is the browser-loadable URL (signed-redirect route for S3 logos). |
