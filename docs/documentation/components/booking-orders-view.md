# `app/_components/Dahsboard/booking/orders/BookingOrdersView.tsx`

## Purpose
The booking order list shared by Main orders (`app/(User)/dashboard/booking/page.tsx`) and Insurance cases (`app/(User)/dashboard/booking/insurance-cases/page.tsx`). Coordinates order loading, filter state, selection state, and the archive modals.

## Functions
### `BookingOrdersView({ insuranceCases? })`
Loads archive rows and filter options, applies the current user's saved language to booking UI labels, sends the store filter to `/api/orders` through `createdById`, passes store options including primary and warehouse email addresses into the selection action bar, and remounts that action bar when the applied store changes so its local form state resets without an effect. It coordinates the archive table, modal state, bulk actions, and selected-row exports, aborts superseded archive requests so slow initial loads cannot overwrite newer filter results, passes the rendered order count to the filter panel for show-all date-range placeholder text, uses one shared selection capability for admin, subcontractor, and order-creator checkbox selection, enables selected-row exports without exposing admin bulk actions to read-only roles, and keeps the archive wrapper on full available width.

When `insuranceCases` (`{ storeMembershipId, storeLabel }`) is passed, the list is locked to that store: the access object gets `canFilterCreatedBy: false` + `lockedCreatedById` (so `BookingFilters` hides the Store filter and keeps `createdById` pinned, including on reset), the default/reset filters carry that `createdById`, the title becomes "Insurance cases" with the store name underneath, the `BulkUpdateBar` is not rendered, and `SelectionActionBar` is rendered with `showStoreEmail={false}` and `showSendGsm={false}` (only Copy selected / Export Excel / Hide columns remain).
