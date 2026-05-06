# Current User Hook

## Source

- `lib/users/useCurrentUser.ts`

## Responsibility

Loads the authenticated user summary for dashboard UI components such as the sidebar and exposes the active tenant role, permissions, saved language preference, and sidebar profile appearance fields.

## Functions

| Function | Description |
| --- | --- |
| `useCurrentUser` | Fetches `/api/auth/me`, normalizes the current user payload, and returns the user identity, sidebar logo, sidebar username color, language preference, role, and permissions. |
