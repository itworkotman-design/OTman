# `app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal.tsx`

## Purpose
Renders the read-only order details modal and print/PDF view used outside the editable admin modal. Subcontractor and order-creator views show the requested order-detail table beside a calculator-style price panel, and the same layout is written to the generated print/PDF HTML. Subcontractors see subcontractor totals; order creators see customer totals. Admin/owner fallback rendering is unchanged.

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

### `escapeHtml(value)`
Escapes generated print/PDF HTML values before writing them into the new browser window.

### `formatLift(value)`
Normalizes saved lift values into Norwegian yes/no labels when possible.

### `getPdfDetailRows(order)`
Builds the fixed order-detail table rows used by subcontractor and order-creator PDF views.

### `getCalculatorDisplayData(order, viewMode)`
Groups saved order item rows into calculator display groups and resolves role-specific totals.

### `renderCalculatorHtml(data)`
Builds the calculator-side HTML used by the generated print/PDF document.

### `downloadOrderPdf(order, viewMode)`
Builds the printable order-details HTML, formats dates with the shared slash-date helper, uses the role-appropriate visible price, and opens the browser print dialog.

### `OrderPdfCalculator(props)`
Renders the calculator-style price panel in the read-only modal using the same row/container classes as the order modal calculator.

### `ReadOnlyOrderModal(props)`
Renders the read-only modal. Subcontractor and order-creator views use the order-detail table plus calculator panel; other roles keep the previous details and totals layout.
