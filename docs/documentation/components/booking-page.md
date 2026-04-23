# `app/(User)/dashboard/booking/page.tsx`

## Purpose
Coordinates the booking archive page, including order loading, filter state, selection state, and the archive modals.

## Functions
### `BookingPage()`
Loads archive rows and filter options, sends the creator filter to `/api/orders` through `createdById`, passes creator options into both the archive filter panel and selection action bar, and coordinates the archive table, modal state, bulk actions, and exports.
