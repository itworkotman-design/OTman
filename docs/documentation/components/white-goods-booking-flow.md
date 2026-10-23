# White Goods Booking Flow

## Source

- `app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow.tsx`

## Responsibility

The homepage booking modal for every website catalog (white goods, furniture, parcel/pallet). It walks the customer through customer type, category, products and options, pickup stops, order details and contact, then a summary page. The price comes from the shared `priceWebsiteOrder`. Website prices are ex. VAT, and the customer's total incl. VAT is `websiteCustomerTotals` (each line +25%, rounded to whole kroner, summed). Every price shown goes through `websiteCustomerPrice`. The order is submitted with the incl.-VAT `shownTotal` it displayed (see `api/site-white-goods-order.md`). On the Your details step (`ContactDetailsCard`), a private customer gives their full name; a business gives its company name (sent as `name`) and org number (`orgNumber`, required and checked with `isValidOrgNumber` before "Go to summary"). In customer mode the org number is shown read-only and the server keeps the stored one. It also sends which product cards each pickup stop collects (`pickupCardIds`, plus `cardIds` per extra location).

Admins no longer edit through this flow: `WebsiteOrderModal`'s "Edit order" tab uses `WebsiteOrderEditTab` (see `website-order-edit-tab.md`), which reuses this flow's product card and size-bracket picker.

## Customer mode (`customer` prop)

"My order" (`CustomerOrderClient`) opens the same modal for the customer's own order, with `customer: { orderNumber, beforeCutoff, onSaved }`. It fills the flow through `loadOrderIntoFlow`, and the distance is only looked up again once a stop's address actually changes.

- **Data:** it loads `GET /api/customer/orders/[orderNumber]`. The live price uses the order's `pricingContext` (staff-set express, discount, extra and deviation) and its km rule.
- **Sections:** `showAll`, without the customer-type step or the start-category step.
- **After the 24h cutoff (`beforeCutoff` false):** the modal swaps to its own "late change" sections, all untitled (`SteppedModal` skips an empty title): the contact step (name, phone, email, comment), `PickupContactPersonsCard` (the contact person at each private/business pickup, hidden when every pickup is a store) and the product-options steps without the calculator, holding only the cards with a service left to add (`hasAddableServices`; a step with none is hidden). Each product card gets its card as booked (`booked`, from the order as loaded) and renders as the product icon on the left and only the not-yet-booked additional services on the right; booked services stay on the card (`keepBookedServices`, see `bookedServices.ts`). Delivery and installation can't change there. The quantity, products, stops and date can't change. The draft's pickups are the stops exactly as the server sent them, with only the contact persons from the form (`withPickupContacts`), so an older order whose stops the page rebuilt never reads as an address change.
- **Footer:** `CustomerOrderEditFooter`. It gets the order as loaded (captured once the flow settles) and the current draft, and sends only what changed (`buildCustomerEditPayload`). The server price is what gets saved. Before the cutoff its button is "Go to summary": it opens the final step (the same summary page a new order ends on, without "Submit order"), and the bar there turns into "Save changes". "Back" returns to the editor. Within 24h it saves straight away (`customerEditPrimaryAction`).

## Edit mode: pickup assignment

In customer edit mode, the flow runs `findCardsWithoutPickup` on `editedDetails.pickups` (the stops it is about to send) and passes a `blockedMessage` to `CustomerOrderEditFooter`, so Save stays disabled while any product has no pickup address. Within 24h of the job, when the customer can't edit pickups, the message tells them to contact us. Before the cutoff it also runs `findPickupsWithoutProducts`: a pickup address with no products blocks Save too, naming the pickup. Store pickups never send a contact person (in the payload or the review summary).
