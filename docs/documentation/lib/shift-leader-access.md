# `lib/booking/shiftLeaderAccess.ts`

## Purpose
Server-side gate for the shift leader feature on the booking orders page. Only active company `OWNER`/`ADMIN` members (the "ADMIN" booking view mode) may see or set the shift leader; subcontractors and order creators get `403` from `/api/shift-leader` and `/api/shift-leader/admins`.

## Functions
### `canAccessShiftLeader(userId, companyId)`
Looks up the user's membership in the company and returns `true` only when it is `ACTIVE` with role `OWNER` or `ADMIN`.
