# `app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal.tsx`

## Purpose
Renders the read-only order details modal and print/PDF view used outside the editable admin modal. Subcontractor and order-creator views show the requested order-detail table beside the same calculator display component used by the admin editor. Subcontractors see subcontractor totals; order creators see customer totals. The calculator renders saved product codes, descriptions, and prices from the order snapshot/items, including priced product-card rows and WordPress unmatched rows without importer warning comments. Admin/owner fallback rendering is unchanged.

## Functions
### `formatCell(value)`
Normalizes blank string values into `-` for the read-only order view.

### `formatMoney(value)`
Formats numeric totals for the read-only order view.

### `formatExtraPickup(value)`
Formats the extra-pickup address list into a comma-separated string.

### `getVisibleOrderPrice(order, viewMode)`
Returns the subcontractor price for subcontractor view and the full ex-VAT price for other views.

### `isCalculatorPdfView(viewMode)`
Checks whether the role should use the new PDF calculator layout.

### `parseNokAdjustment(value)`
Parses stored manual adjustment strings into numeric NOK values for display rows.

### `roundMoney(value)`
Rounds calculator values to two decimals.

### `formatQty(qty)`
Formats calculator line quantities using half-step precision.

### `getCalculatorLineLabel(item)`
Returns the best visible calculator description from option label, delivery type, product name, or code so saved priced rows are not dropped when one field is blank.

### `buildAdminStyleProductBreakdowns(order, viewMode)`
Converts saved read-only calculator items into admin calculator product breakdowns, using subcontractor line prices for subcontractor view and customer line prices otherwise.

### `escapeHtml(value)`
Escapes generated print/PDF HTML values before writing them into the new browser window.

### `formatLift(value)`
Normalizes saved lift values into Norwegian yes/no labels when possible.

### `getPdfDetailRows(order)`
Builds the fixed order-detail table rows used by subcontractor and order-creator PDF views.

### `getCalculatorDisplayData(order, viewMode)`
Groups saved order item rows into calculator display groups, keeps priced rows even when they are product-card rows, and resolves role-specific totals.

### `renderCalculatorHtml(data)`
Builds the calculator-side HTML used by the generated print/PDF document.

### `downloadOrderPdf(order, viewMode)`
Builds the printable order-details HTML, formats dates with the shared slash-date helper, uses the role-appropriate visible price, and opens the browser print dialog.

### `OrderPdfCalculator(props)`
Renders the calculator-style price panel in the read-only modal using the same row/container classes as the order modal calculator.

### `AdminStyleReadOnlyCalculator(props)`
Renders the read-only role calculator through the same `CalculatorDisplayNew` component used by the admin order editor.

### `ReadOnlyOrderModal(props)`
Renders the read-only modal. Subcontractor and order-creator views use the order-detail table plus calculator panel, order creators no longer get a separate contact button because contact opens from the archive alert column, and other roles keep the previous details and totals layout.
