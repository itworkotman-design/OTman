# `app/_components/site/BookingModal/whiteGoods/DateTimeWindowFields.tsx`

## Purpose
"Ønsket dato" (`DatePicker`) + "Tidsvindu" (`TimeWindowField`) side by side, stacked on phones.
Shared by the delivery modal's `OrderDetailsCard` and the moving flow's "When?" step, so both
book on the same rules: from tomorrow (Oslo time), no Sundays, no Norwegian public holidays.

## Functions
### `DateTimeWindowFields({ locale, preferredDate, setPreferredDate, timeWindow, setTimeWindow, dateError, timeWindowError })`
Controlled; the caller decides when each field shows its red error state.

The date picker opens upward (`DatePicker`'s `openUpward`): this is the last field of a long stepped modal, so a calendar opening downward would land below the fold and need scrolling to.
