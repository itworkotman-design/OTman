# Subcontractors API

## Source

- `app/api/auth/subcontractors/route.ts`

## Responsibility

Returns the active memberships that should be treated as subcontractors in booking flows.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Filters active memberships down to subcontractor-access users and returns option objects with id, label, email, and the optional saved address. |
