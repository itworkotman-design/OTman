# `app/_components/Dahsboard/booking/orders/TopFiltersField.tsx`

## Purpose
Renders the legacy top filter bar used on the orders view.

## Functions
### `TopFilters(props)`
Owns the legacy orders filter state, applies and resets the selected filters, supports quick date shortcuts, and keeps the status options aligned with the canonical lowercase order-status keys.

### `Field(props)`
Wraps one labeled filter control with the shared spacing and text styles.

### `ComboField(props)`
Renders the searchable Headless UI combobox used for customer and subcontractor filters.
