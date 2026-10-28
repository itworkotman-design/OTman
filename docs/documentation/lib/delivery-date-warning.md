# lib/booking/deliveryDateWarning.ts

Picks the non-blocking warning shown under the delivery date in `BookingEditor`.

## Functions

- `getDeliveryDateWarning({ deliveryDate, today, deliveryDateChanged, allowPastDeliveryDates })` — returns a `bookingUiText` key, or `null`. Only fires when the date was changed from the saved value. Today → `"Warning: delivery date is today"` for everyone; a past date → `"Warning: delivery date is in the past"` only when the user may pick past dates (otherwise it's a validation error, handled in `BookingEditor`).
