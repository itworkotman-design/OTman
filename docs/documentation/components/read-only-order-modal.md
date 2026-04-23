# `app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal.tsx`

## Purpose
Renders the read-only order details modal and print/PDF view used outside the editable admin modal.

## Functions
### `formatCell(value)`
Normalizes blank string values into `-` for the read-only order view.

### `formatMoney(value)`
Formats numeric totals for the read-only order view.

### `formatExtraPickup(value)`
Formats the extra-pickup address list into a comma-separated string.

### `downloadOrderPdf(order)`
Builds the printable order-details HTML and opens the browser print dialog.

### `ReadOnlyOrderModal(props)`
Renders the read-only order details modal and labels the store field as `Store` while keeping the customer-name field separate as `Customer name`.
