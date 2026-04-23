# `app/(User)/booking/page.tsx`

## Purpose
Coordinates the read-only booking archive page for non-admin users.

## Functions
### `BookingPage()`
Loads archive rows and filter options for the read-only booking page, forwards the creator filter to `/api/orders` through `createdById`, and coordinates the archive table plus the read-only and email modals.
