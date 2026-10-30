# `app/api/orders/[orderId]/moving-details/route.ts`

## Purpose
`PUT` — the admin's edit of a homepage move (WebsiteOrderModal, `websiteOrderKind: "MOVING"`). Owner/admin or Website orders
at ADMIN level. Tested.

- `edit` (a `MovingEdit`) — re-priced from the moving catalog (`priceMovingOrder`), the distance looked up again only when an
  address moved; lines replaced (`movingOrderSaveWrites`). Refused (409) on cancelled/completed/invoiced/paid orders.
- `customer`, `preferredDate`, `timeWindow` — contact details and schedule.
- `customerType` (`private` / `business`) — stored in the booking details (kept on an `edit`'s re-priced move); it only
  changes what the customer is shown, never the price. Anything else is `422 INVALID_DETAILS`.
- `handling` — the "Handle order" panel's fields (drivers, driver info, plate, internal description, date, time window) and
  the calculator's discount/extra and partner minus/plus (`rabatt`, `leggTil`, `subcontractorMinus`, `subcontractorPlus`; left
  out = stored value kept). Changed amounts re-price the stored lines with them (`movingOrderAdjustedPricing`); an `edit`
  keeps them on its re-priced lines. Express and the deviation (incl. a custom one's `customDeviation`) are stored and become
  the move's own lines (`movingHandlingItemRows`, priced from the moving price list's settings), replacing the old ones in a
  transaction (`movingOrderItemWrites`); an `edit` carries the stored ones over as priced. `nulledLines`
  (the calculator's "Set to 0") is stored on the snapshot (`movingNulledLines`) and re-prices the lines too.
- `adjustmentLines` (optional) — the calculator's adjustment lines (`readSubmittedAdjustmentLines`, `lib/orders/website-order-adjustment-lines.md`): their per-kind sums replace `handling`'s discount/extra/partner minus/plus, and the lines are stored in `pricingSnapshot.adjustmentLines` on whichever snapshot the save writes (the stored one when only descriptions changed). Not a list → `400 INVALID_BODY`.
- `useCurrentPrices` — "Use new price": the move's own answers (or the `edit`) re-priced at today's catalog. An `edit` of a
  move whose stored prices are outdated (`movingPricesOutdated`) is refused with `409 PRICES_OUTDATED` without it, as on a
  delivery order; changing only the amounts or lines set to 0 re-prices the stored lines and needs nothing.
- `dryRun` — returns the price, the paid-vs-now `comparison` and `calculator` (`movingOrderCalculatorView` of the order after
  the save) without saving — what `WebsiteOrderCalculator` previews with, in the Overview and the Edit tab.
Status and partner save through `/api/orders/bulk`. Changes are logged on the order's history.
