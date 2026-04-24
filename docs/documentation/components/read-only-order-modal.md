# `app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal.tsx`

## Purpose
Renders the read-only order details modal and print/PDF view used outside the editable admin modal. The modal and generated print HTML now render `deliveryDate` in explicit `dd/mm/yyyy` format instead of relying on browser locale parsing.

## Functions
### `formatCell(value)`
Normalizes blank string values into `-` for the read-only order view.

### `formatMoney(value)`
Formats numeric totals for the read-only order view.

### `formatExtraPickup(value)`
Formats the extra-pickup address list into a comma-separated string.

### `downloadOrderPdf(order)`
Builds the printable order-details HTML, formats `deliveryDate` with the shared slash-date helper, and opens the browser print dialog.

### `ReadOnlyOrderModal(props)`
Renders the read-only order details modal, labels the store field as `Store` while keeping the customer-name field separate as `Customer name`, and formats the displayed delivery date as `dd/mm/yyyy`.
