# Booking Calculator Panel

## Source

- `app/_components/Dahsboard/booking/create/BookingCalculatorPanel.tsx`

## Responsibility

Wraps the booking calculator for desktop and mobile layouts and shows the price-update warning when a saved order has older prices than the current catalog. The warning shows stored and current-catalog totals, then each row whose price changed (`priceChangeRows`, from `diffCalculatorRows`): "Washing machine: Install – approved wet room 1220 NOK → 1230 NOK", plus the partner price change in the admin view. Non-admins only see rows whose customer price changed. It forwards native manual adjustments, including discounts, extras, subcontractor minus, and subcontractor plus.

## Functions

| Function | Description |
| --- | --- |
| `BookingCalculatorPanel` | Renders the calculator in sidebar or mobile drawer mode, shows the red price-update action with old/new totals and the changed rows when available, forwards forced stored totals for frozen orders, and forwards calculator totals and admin adjustments to the editor. |

## When the warning shows

`BookingEditor` prices an existing order twice: at the catalog prices saved on its cards and at today's catalog. `hasCurrentPriceUpdates` is true only when `diffCalculatorRows` finds a row whose customer or partner price differs between the two. A stored total that merely differs from a fresh calculation no longer triggers it.
