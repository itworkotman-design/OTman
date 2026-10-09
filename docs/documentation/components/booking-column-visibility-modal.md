# `app/_components/Dahsboard/booking/archive/BookingColumnVisibilityModal.tsx`

## Purpose
Modal where the user toggles which booking-archive columns are visible in the table and in the Excel export.

## Functions
### `BookingColumnVisibilityModal(props)`
Lists the columns for `viewMode` (with the pricelist column only when `showPricelistColumn` is set), or the explicit `columns` override when one is passed (the Website orders page passes its narrower set). It won't let the user hide the last visible column, and it closes on Escape or a backdrop click.
