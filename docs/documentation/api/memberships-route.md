# Memberships API

## Source

- `app/api/auth/memberships/route.ts`

## Responsibility

Lists memberships for the active company so the dashboard user-management page can render user profiles, permissions, price lists, and online state.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Returns company memberships with nested user profile data, permission flags, price-list assignments, and derived online presence. The nested user payload now includes the optional saved address, logo path, and username display color. |
