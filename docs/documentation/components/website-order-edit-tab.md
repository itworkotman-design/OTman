# Website Order Edit Tab

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderEditTab.tsx`
- `app/_components/Dahsboard/booking/websiteOrders/websiteOrderEditorState.ts`

## Responsibility

The admin editor for a homepage (white-goods) order: the **Edit order** tab of `WebsiteOrderModal`. Fields use the dashboard style (`customContainer`, `customInput`, `AddressAutocompleteInput`). Products use the website's own `WhiteGoodsProductCard` and `SizeBracketPicker`, so the admin follows exactly the same product rules as the customer's booking flow (install types and add-on requirements, assembly + dismantling, install-only, size brackets and item names).

## Behaviour

The left column runs Products → Pickup addresses → Delivery → Customer. The right column has the two calculators and the save buttons.

- **Load:** `GET /api/orders/[orderId]/website-items` returns the cards, details, website catalog and categories. Stops become editor stops through `stopsFromDetails`, which places products by card id, or by stored product name on older orders.
- **Customer:** name, type, phone, email and comments.
- **Pickup addresses:** one card per stop (type, place name, address, floor/lift unless it's a store, contact). Each stop lists the products it collects as a checklist. Ticking a product on one stop removes it from the others (`toggleCardOnStop`). With a single stop, everything is collected there. "+ Add pickup address" adds a stop, and removing a stop leaves its products unassigned (`addStop` / `removeStop`).
- **Delivery:** address, floor/lift, date and time window.
- **Products:** the last thing in the section is a full-width "Add extra products" button, as in the booking app. It opens a product list grouped by website category (`addProductToOrder`). A product already on the order gets another card next to its others. With one stop a new product is placed there; with several it stays unassigned until ticked. Each product is one `WhiteGoodsProductCard`: its title band has the quantity (except size-priced items, through `headerExtra`), "#n" when a product has several cards, and Remove (`removeCardFromOrder`). For a size-priced item (Other furniture), the name, size and weight (`SizeBracketPicker`, `embedded`) are the last section of the same card (`belowOptions`), numbered on after Delivery / Installation / Extras.
- **Calculators:** every change is priced by a debounced `PUT … { dryRun: true }`, and both of the Overview's calculators are shown, read-only.
  - **Customer:** the lines, discount, extra and total ex. VAT (customer amounts are stored incl. VAT), then VAT, the total incl. VAT, and `WebsiteOrderPaymentSummary` (paid vs new total).
  - **Partner view:** the partner's lines, minus, plus and total.
  - Discount, extra and partner minus/plus are still set in the Overview calculator.
- **Save:** `PUT /api/orders/[orderId]/website-items` with `{ productCards, details }` (`stopsForSave` adds each stop's `productNames`). Save is disabled while nothing changed or `editorBlockers` reports a missing pickup address, size bracket, item name or installation. The server enforces the pickup rule too (`PRODUCT_WITHOUT_PICKUP`). There is no "send payment link": orders are prepaid.
- `onDirtyChange` tells the modal whether there are unsaved edits.

## Functions (`websiteOrderEditorState.ts`)

| Function | Description |
| --- | --- |
| `stopsFromDetails` | Stored stops → editor stops with `cardIds` (via `claimsPerStop`). One stop, or none, collects everything. |
| `toggleCardOnStop` | Ticks or unticks a product on a stop; a product is only ever on one stop. |
| `addProductToOrder` / `removeCardFromOrder` | Adds a card (`applyProductQuantity` / `addAnotherProductCard`) or removes one, keeping the stops in step. |
| `addStop` / `removeStop` | Adds an empty stop, or removes one (never the last). |
| `stopsForSave` | Editor stops → `AdminPickupStop[]` with `productNames`. |
| `editorBlockers` | What keeps Save disabled: `findCardsWithoutPickup`, size-bracket problems, missing item names, install-only without an installation. |
