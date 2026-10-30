# GET /api/orders/[orderId]/website-details

## Source

- `app/api/orders/[orderId]/website-details/route.ts`

## Responsibility

Read-only data for the admin `WebsiteOrderModal`. It's kept separate from `GET /api/orders/[orderId]` (which backs the regular `BookingEditor`) so that route stays untouched.

**Access:** an authenticated session with an active company, and a company `OWNER`/`ADMIN` or a member with the `WEBSITE_ORDERS` module enabled. The order is scoped to the active company.

## Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, order }` | The order is a white-goods website order with valid details. `order` contains the id, display id, order number, status, created date, customer name/phone/email, customer comments, status notes, `priceExVat` (the client total), the parsed `details` with the live order columns laid over them (`withLiveOrderFields`), `products` grouped per card, `totalsCheck` (`checkWebsiteOrderTotals`: lines vs. total vs. the total shown at booking), and the partner (`subcontractorMembershipId`, `subcontractor`) and GSM state (`gsmSentAt`, `gsmSyncStatus`) for the admin actions, `payment` (`compareOrderWithPayments`: paid vs. now), `calculator` (the stored order priced with `recomputeWebsiteOrderPricing` at the catalog prices it was saved with (`resolveSavedCatalogPricing`: from its cards, or read back from an older order's stored lines), as `websiteOrderCalculatorView`, so every line, the totals and the partner side show the saved prices; only when none can be found is it priced with today's catalog; partner prices only for a company owner/admin or `WEBSITE_ORDERS` admin; `null` if pricing fails), `currentPricesTotal` (the customer total at today's catalog prices; the calculator offers "Use new price" when it differs from `priceExVat`; `null` if pricing fails), `priceChanges` (each calculator row priced differently at today's catalog than at the saved prices: `{ productName, label, saved, now, savedPartner, nowPartner }`, from `diffCalculatorRows` (`lib/booking/pricing/priceChanges.ts`); `productName` is null for an order-level row, and the partner prices are null for a viewer who can't see them), `savedPricesIncomplete` (names of products whose saved prices lack their delivery type or a selected option, `findMissingSnapshotPrices`; the order may be stored without that charge), `handling` (`handlingFromOrder`: driver, deviation, discount, extra, express, description, and so on), and `adjustmentLines` (`storedAdjustmentLines` of `pricingSnapshot.adjustmentLines`: the calculator's discount/extra/partner minus/plus lines with descriptions, or an older order's four amounts as plain lines; partner lines only for those who may see partner prices; for every kind of homepage order). |
| 401 / 409 / 403 | `{ ok: false, reason }` | No session, no active company, or no access. |
| 404 | `{ ok: false, reason: "NOT_FOUND" }` | No such order in this company. |
| 404 | `{ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" }` | Any other order: a non-website order, another website request type, or an older white-goods order without details. |

`DashboardOrderModal` treats every non-ok answer as "use the regular `OrderModal`".

`order.hasCustomerLogin` is true when the order is linked to a live "My order" login (not past its delete time) whose email is the order's current email. The modal then hides "Send new login".

## Homepage moves
A `MOVING` order with stored answers returns `{ kind: "moving", moving: { edit, customerType, preferredDate, timeWindow,
drivingDistance }, sizeOptions, products, orderExtras, totalsCheck, calculator }` — its lines read
from `Order.items` (`movingOrderPriceView`), and `calculator` the same calculator view a delivery order has
(`movingOrderCalculatorView` with the stored discount/extra, partner minus/plus and lines set to 0; partner side for admins only;
`totalsCheck` counts a line set to 0 at 0), plus `currentPricesTotal`/`priceChanges` for "Use new price" (`movingCurrentPriceRows`
+ `movingPriceChanges`). The fields every website order shares are built once
(`base`). A move booked before its answers were stored still answers `NOT_WHITE_GOODS_WEBSITE_ORDER` (regular modal).

## Homepage service requests
A `SERVICE` order with stored answers returns `{ kind: "service", service: { edit, customerType, preferredDate, timeWindow },
products: [], totalsCheck, calculator }` — `edit` from `serviceEditFromOrder` (each service's partner price `null` for viewers),
`calculator` from `serviceOrderCalculatorView`, `handling` from `movingHandlingFromOrder`. A request sent before its answers
were stored still answers `NOT_WHITE_GOODS_WEBSITE_ORDER` (regular modal).
