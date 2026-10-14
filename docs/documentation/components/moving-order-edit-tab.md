# `app/_components/Dahsboard/booking/websiteOrders/MovingOrderEditTab.tsx`

## Purpose
The admin's "Edit order" tab for a homepage move in `WebsiteOrderModal`, in the same dashboard style as the delivery Edit tab
(`WebsiteOrderEditTab`, shared pieces in `EditTabParts.tsx`): `customContainer` sections with bordered cards (`CardHeading`),
`ChoiceButton` toggles and `customInput` fields, not the homepage booking flow's sections.

## Behaviour
- **Moving from / Moving to:** one card per end — type (Apartment / Townhouse / Detached house / Office), address
  (`AddressAutocompleteInput` with a search icon), size (the moving catalog's sizes), floors in the home, and for an apartment or
  office its floor and — unless it's the ground floor — the lift (Yes / No), then parking. Same rules as the booking flow
  (`movingLiftApplies`, `movingLiftRequired`); what's missing shows in red under the field and keeps Save disabled
  (`movingEditBlockers`, which checks each end with the server's `parseMovingProperty`).
- **Additional services:** toggle buttons with their price.
- **Date and time:** the date, and the time window as the delivery tab asks it (`TimeWindowChoice`: presets, "Custom time" with
  any from/to, an older free-text window kept). An incomplete custom time blocks Save.
- **Customer:** Private / Business, name, phone, email, comments.
- **Calculator:** the Overview's `WebsiteOrderCalculator` beside them (same lines, codes, partner side, set to 0, discount/extra
  and partner minus/plus — `externalPricing`, so its changes are priced and saved together with the edits as `handling` +
  `nulledLines`). "Use new price" works as on a delivery's Edit tab: while `priceChanges` lists any, changing the move itself
  can't be saved until it's chosen (`useCurrentPrices`). The payment preview sits under it.
- Every change is priced by `PUT /api/orders/[orderId]/moving-details` (`dryRun`, debounced) and saved at that price. Only the
  changed parts are sent (`movingEditBody.ts`: `edit`, `customer`, `customerType`, `preferredDate` + `timeWindow`; tested).
  Drivers etc. stay in the Overview's "Handle order" panel.

## `movingEditBody.ts`
- `movingEditBody(initial, current)` — the save body, only what changed.
- `movingEditBlockers(draft)` — `{ end, field }[]` keeping Save disabled: a missing address, an end field the server would
  reject, or an incomplete time window.
