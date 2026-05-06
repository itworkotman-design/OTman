# Me Language API

## Source

- `app/api/auth/me/language/route.ts`

## Responsibility

Saves the authenticated user's dashboard language preference.

## Functions

| Function | Description |
| --- | --- |
| `PATCH` | Validates the session, accepts `EN` or `NO`, and stores the value on `User.languagePreference`. |
