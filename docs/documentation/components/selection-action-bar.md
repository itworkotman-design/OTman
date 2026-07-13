# `app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx`

## Purpose
Renders the archive action bar for sending selected orders by email or GSM and for export/copy actions.

## Functions
### `SelectionActionBar(props)`
Tracks the selected creator, email template, recipient checkboxes, and success flashes for the archive bulk-action bar. It initializes the creator from the selected store, shows recipient checkboxes after a creator is selected, defaults to the primary email only, disables sending when no recipient is selected, and uses the creator options supplied by the booking page. The parent remounts the component when the applied store changes, so the form resets without synchronously setting state in an effect.
