# `app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx`

## Purpose
Renders the archive action bar for sending selected orders by email or GSM and for export/copy actions.

## Functions
### `SelectionActionBar(props)`
Tracks the selected creator, email template, recipient checkboxes, and success flashes for the archive bulk-action bar, only shows the recipient checkboxes after a creator is selected, defaults the warehouse-email checkbox on when a creator has a second email, disables sending when no recipient checkbox is selected, and uses the creator options list supplied by the booking page.
