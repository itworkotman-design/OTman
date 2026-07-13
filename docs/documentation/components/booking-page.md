# `app/(User)/dashboard/booking/page.tsx`

## Purpose
Coordinates the booking archive page, including order loading, filter state, selection state, and the archive modals.

## Functions
### `BookingPage()`
Loads archive rows and filter options, applies the current user's saved language to booking UI labels, sends the store filter to `/api/orders` through `createdById`, passes store options including primary and warehouse email addresses into the selection action bar, and remounts that action bar when the applied store changes so its local form state resets without an effect. It coordinates the archive table, modal state, bulk actions, and selected-row exports, aborts superseded archive requests so slow initial loads cannot overwrite newer filter results, passes the rendered order count to the filter panel for show-all date-range placeholder text, uses one shared selection capability for admin, subcontractor, and order-creator checkbox selection, enables selected-row exports without exposing admin bulk actions to read-only roles, keeps the archive wrapper on full available width so collapsing the sidebar does not leave a white gap on the right, and no longer renders the archive sort controls above the table.
