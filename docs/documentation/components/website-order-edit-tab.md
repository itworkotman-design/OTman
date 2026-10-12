# Website Order Edit Tab

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderEditTab.tsx`
- `app/_components/Dahsboard/booking/websiteOrders/websiteOrderEditorState.ts`

## Responsibility

The admin editor for a homepage (white-goods) order: the **Edit order** tab of `WebsiteOrderModal`. Fields use the dashboard style (`customContainer`, `customInput`, `AddressAutocompleteInput`). Products use the website's own `WhiteGoodsProductCard` and `SizeBracketPicker`, so the admin follows exactly the same product rules as the customer's booking flow (install types and add-on requirements, assembly + dismantling, install-only, size brackets and item names).

## Behaviour

The left column runs Products → Pickup addresses → Delivery → Customer. It ends, like the Overview, with the save blockers and one row: the modal's red "Delete order" (passed in as `besideSave`, the same button the Overview uses), Cancel (back to Overview), and "Save changes" filling the rest. The right column has the calculator and the payment preview.

- **Load:** `GET /api/orders/[orderId]/website-items` returns the cards, details, website catalog and categories. Stops become editor stops through `stopsFromDetails`, which places products by card id, or by stored product name on older orders.
- **Customer:** a bordered card headed by the customer's name, with phone · email as its summary and a house or building badge. Private / Business are icon buttons (`ChoiceButton`), then name, phone (`tel`), email (`email`) and the customer's comments.
- **Pickup addresses:** styled like the booking app's `PickupLocations`. There is one bordered card per stop, with a numbered badge, a summary line (place name · address) and a round "−" remove button. Each card has the type as Store / Private / Business icon buttons, the address with a search icon, then place name, floor/lift (unless it's a store) and contact. Each stop lists its products as toggle chips: filled = collected here, red = on no pickup yet, grey = at another pickup (shown in brackets). Turning a product on at one stop removes it from the others (`toggleCardOnStop`). A stop that has products but no address shows a red warning. With a single stop, everything is collected there. The dashed "Add pickup address" button at the bottom adds a stop. Removing a stop leaves its products unassigned (`addStop` / `removeStop`).
- **Delivery:** a bordered card (truck badge, summary: address · date · time window). It has the address with a search icon, floor/lift, then the date and the time window as buttons: the two presets and "Custom time". Custom time opens From / To time inputs with any times allowed, like an admin in the booking app, and is saved as "HH:MM-HH:MM" (`buildTimeWindowValue`). While from/to is incomplete or the end is not after the start, Save is blocked with `TIME_WINDOW_INCOMPLETE` (`isTimeWindowComplete`). An older free-text window stays as its own button. Every card (pickup, delivery, customer) uses the same `CardHeading`.
- **Products:** the order's own products open collapsed (`defaultOpen={false}` on `WhiteGoodsProductCard`, which can be expanded from the title band), while products added in the tab open expanded. the last thing in the section is a full-width "Add extra products" button, as in the booking app. It opens a product list grouped by website category (`addProductToOrder`). A product already on the order gets another card next to its others. With one stop a new product is placed there; with several it stays unassigned until ticked. Each product is one `WhiteGoodsProductCard`: its title band has "#n" when a product has several cards, and Remove (`removeCardFromOrder`). The card's last section (`belowOptions`, numbered on after Delivery / Installation / Extras) is the **Product amount** (a numbered section heading like the card's own, `SectionHeader`, over the booking app's full-width `customInput`), or for a size-priced item (Other furniture, one card per item) its name, size and weight (`SizeBracketPicker`, `embedded`).
- **Calculator:** the Overview's own `WebsiteOrderCalculator` (customer and partner side, "set to 0" checkboxes, discount, extra, partner minus/plus), in its `externalPricing` mode. Every change, to the products, stops and details or to the calculator's choices (`onDraftChange`), is priced by one debounced `PUT … { dryRun: true }` that includes `handling` + `nulledLines`. The result goes back into the calculator, so it never fetches or saves on its own. Its baseline is the order as first priced. `WebsiteOrderPaymentSummary` sits under it (paid vs new total). The column scrolls with the page, like Overview.
- **Save:** one `PUT /api/orders/[orderId]/website-items` with `{ productCards, details }`, plus `handling` and `nulledLines` when the calculator was changed, (`stopsForSave` adds each stop's `productNames`). Save is disabled while nothing changed or `editorBlockers` reports a missing pickup address, size bracket, item name or installation. The pickup blocker names the products still missing a pickup address. The server enforces the pickup rule too (`PRODUCT_WITHOUT_PICKUP`); a dry-run error that repeats a blocker already listed is not shown a second time. There is no "send payment link": orders are prepaid.
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
