# `app/(User)/dashboard/booking/page.tsx`

## Purpose
Coordinates the booking archive page, including order loading, filter state, selection state, and the archive modals.

## Functions
### `BookingPage()`
Loads archive rows and filter options, sends the store filter to `/api/orders` through `createdById`, passes store options including primary and warehouse email addresses into the selection action bar, coordinates the archive table, modal state, bulk actions, and exports, keeps the archive wrapper on full available width so collapsing the sidebar does not leave a white gap on the right, and no longer renders the archive sort controls above the table.
