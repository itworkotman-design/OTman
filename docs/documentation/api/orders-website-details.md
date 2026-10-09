# GET /api/orders/[orderId]/website-details

## Source

- `app/api/orders/[orderId]/website-details/route.ts`

## Responsibility

Read-only data for the admin `WebsiteOrderModal`. It's kept separate from `GET /api/orders/[orderId]` (which backs the regular `BookingEditor`) so that route stays untouched.

**Access:** an authenticated session with an active company, and a company `OWNER`/`ADMIN` or a member with the `WEBSITE_ORDERS` module enabled. The order is scoped to the active company.

## Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, order }` | The order is a white-goods website order with valid details. `order` contains the id, display id, order number, status, created date, customer name/phone/email, customer comments, status notes, `priceExVat` (the client total), the parsed `details` with the live order columns laid over them (`withLiveOrderFields`), `products` grouped per card, `totalsCheck` (`checkWebsiteOrderTotals`: lines vs. total vs. the total shown at booking), and the partner (`subcontractorMembershipId`, `subcontractor`) and GSM state (`gsmSentAt`, `gsmSyncStatus`) for the admin actions, `payment` (`compareOrderWithPayments`: paid vs. now), `calculator` (the stored order re-priced with `recomputeWebsiteOrderPricing`, as `websiteOrderCalculatorView`; partner prices only for a company owner/admin or `WEBSITE_ORDERS` admin; `null` if pricing fails), and `handling` (`handlingFromOrder`: driver, deviation, discount, extra, express, description, and so on). |
| 401 / 409 / 403 | `{ ok: false, reason }` | No session, no active company, or no access. |
| 404 | `{ ok: false, reason: "NOT_FOUND" }` | No such order in this company. |
| 404 | `{ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" }` | Any other order: a non-website order, another website request type, or an older white-goods order without details. |

`DashboardOrderModal` treats every non-ok answer as "use the regular `OrderModal`".

`order.hasCustomerLogin` is true when the order is linked to a live "My order" login (not past its delete time) whose email is the order's current email. The modal then hides "Send new login".
