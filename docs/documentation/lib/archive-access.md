# `lib/orders/archiveAccess.ts`

## Purpose
Defines which archive view and filter locks apply to the current signed-in user.

## Functions
### `getBookingArchiveAccess(user)`
Maps the current user's role and booking permissions into the archive view mode, available filters, and any locked creator or subcontractor ids.
