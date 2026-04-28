# `app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal.tsx`

## Purpose
Renders the read-only order details modal and print/PDF view used outside the editable admin modal. The modal and generated print HTML now render `deliveryDate` in explicit `dd/mm/yyyy` format instead of relying on browser locale parsing, show Store from the assigned membership label rather than customer data, and use subcontractor price instead of the full customer total for subcontractor view.

## Functions
### `formatCell(value)`
Normalizes blank string values into `-` for the read-only order view.

### `formatMoney(value)`
Formats numeric totals for the read-only order view.

### `formatExtraPickup(value)`
Formats the extra-pickup address list into a comma-separated string.

### `getVisibleOrderPrice(order, viewMode)`
Returns the subcontractor price for subcontractor view and the full ex-VAT price for other views.

### `downloadOrderPdf(order, viewMode)`
Builds the printable order-details HTML, formats `deliveryDate` with the shared slash-date helper, uses the role-appropriate visible price, and opens the browser print dialog.

### `ReadOnlyOrderModal(props)`
Renders the read-only order details modal, labels the assigned membership as `Store` while keeping the customer-name field separate as `Customer name`, formats the displayed delivery date as `dd/mm/yyyy`, and hides the full customer total from subcontractor users.
