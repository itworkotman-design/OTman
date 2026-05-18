# Login Page

## Source

- `app/(site)/(login)/login/page.tsx`
- `app/(site)/(login)/client-login/page.tsx`
- `app/(site)/(login)/LoginPageContent.tsx`

## Responsibility

Renders the shared login form for both `/login` and the legacy `/client-login` path, submits either a username or e-mail identifier with a password, verifies the resulting session, and redirects users to the correct post-login destination.

## Functions

| Function | Description |
| --- | --- |
| `LoginPage` | Renders the shared login content at `/login`. |
| `ClientLoginPage` | Renders the same shared login content at `/client-login` so saved browser passwords for the old app path can still match. |
| `LoginPageContent` | Manages login form state, submits the identifier-based login request, handles auth errors, verifies the session, and routes users to company selection, booking, or dashboard. |
