# Login Page

## Source

- `app/(site)/(login)/login/page.tsx`

## Responsibility

Renders the login form, submits either a username or e-mail identifier with a password, verifies the resulting session, and redirects users to the correct post-login destination.

## Functions

| Function | Description |
| --- | --- |
| `LoginPage` | Manages login form state, submits the identifier-based login request, handles auth errors, verifies the session, and routes users to company selection, booking, or dashboard. |
