# `app/(User)/booking/page.tsx`

## Purpose
Coordinates the read-only booking archive page for non-admin users.

## Functions
### `BookingPage()`
Loads archive rows and filter options for the read-only booking page, forwards the store filter to `/api/orders` through `createdById`, passes the archive view mode to the read-only modal so subcontractors only see subcontractor pricing, and coordinates the archive table plus the read-only and email modals.
