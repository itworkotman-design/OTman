# Booking UI Text

## Source

- `lib/booking/bookingUiText.ts`

## Responsibility

Stores short booking UI translations and maps status labels for the supported booking locales, including the required order-number validation copy.

## Functions

| Function | Description |
| --- | --- |
| `bookingText` | Returns Norwegian text for a known UI string when `locale` is `nb`; otherwise returns the original string. |
| `bookingStatusText` | Returns a localized status label for known order statuses when `locale` is `nb`. |
