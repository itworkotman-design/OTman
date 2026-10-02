# GET /api/orders/[orderId]/website-details

## Source

- `app/api/orders/[orderId]/website-details/route.ts`

## Responsibility

Read-only data for the admin `WebsiteOrderModal`. It's kept separate from `GET /api/orders/[orderId]` (which backs the regular `BookingEditor`) so that route stays untouched.

**Access:** an authenticated session with an active company, and a company `OWNER`/`ADMIN` or a member with the `WEBSITE_ORDERS` module enabled. The order is scoped to the active company.

## Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, order }` | The order is a white-goods website order with valid details. `order` contains the id, display id, order number, status, created date, customer name/phone/email, customer comments, status notes, `priceExVat` (the client total), the parsed `details` with the live order columns laid over them (`withLiveOrderFields`), `products` grouped per card, `priceDifference` (`unexplainedPriceDifference`), and the partner (`subcontractorMembershipId`, `subcontractor`) and GSM state (`gsmSentAt`, `gsmSyncStatus`) for the admin actions. |
| 401 / 409 / 403 | `{ ok: false, reason }` | No session, no active company, or no access. |
| 404 | `{ ok: false, reason: "NOT_FOUND" }` | No such order in this company. |
| 404 | `{ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" }` | Any other order: a non-website order, another website request type, or an older white-goods order without details. |

`DashboardOrderModal` treats every non-ok answer as "use the regular `OrderModal`".
