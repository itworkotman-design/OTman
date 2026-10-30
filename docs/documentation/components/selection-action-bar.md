# `app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx`

## Purpose
Renders the archive's toolbar for selected orders: prepare-orders email, Send to GSM, SMS, copy, Excel export and column visibility.

## Layout
One row of Remix Icon (`@remixicon/react`) buttons with short labels. Each button's full description is its tooltip/`aria-label`, and labels are translated via `bookingText`.

- **Prepare** (primary, filled): shows the selected count as a badge and a spinner while `loading`. It opens `PrepareEmailModal` via `onSendPrepareToSelected` (see `prepare-email-modal.md`). That modal confirms and sends one prepare-orders email per pickup main user / store of the selected orders. It replaced the old Store / Email type / custom message email form. The Insurance cases page leaves it out by not passing the handler.
- **Segmented group:** GSM (`showSendGsm`, default `true`), SMS (`onSendSms`, optional), Copy (`onCopySelected`, optional; the Website orders page leaves it out) and Excel. All are disabled with nothing selected. After a successful GSM send, that segment flashes green with a check for 1.6s.
- **Columns:** its own button right after the group, separated by the same gap, because it doesn't depend on the selection.
- **Phones:** Prepare goes full width, and the group fills the row with each icon stacked above its label.

Below the row, it shows the GSM success message, `prepareResult` (the "sent to" summary), `error`, and the GSM duplicate warning.

## Functions
### `SelectionActionBar(props)`
Renders the toolbar and status messages, and handles the GSM success flash.

### `ActionButton(props)`
One segment of the group: icon, short label, tooltip, and an optional `success` state.
