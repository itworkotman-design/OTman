# Booking Calculator Panel

## Source

- `app/_components/Dahsboard/booking/create/BookingCalculatorPanel.tsx`

## Responsibility

Wraps the booking calculator for desktop and mobile layouts and shows the price-update warning when a saved order has older prices than the current catalog. It forwards native manual adjustments, including discounts, extras, subcontractor minus, and subcontractor plus.

## Functions

| Function | Description |
| --- | --- |
| `BookingCalculatorPanel` | Renders the calculator in sidebar or mobile drawer mode, shows the red price-update action when available, and forwards calculator totals and admin adjustments to the editor. |
