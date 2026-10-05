# Website Order Admin Actions

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAdminActions.tsx`
- `lib/orders/websiteOrderAdminUpdate.ts`

## Responsibility

The "Handle order" panel in `WebsiteOrderModal`: everything on the order that only an admin handles, without opening the booking editor. One Save covers all of it:

- **Status, status notes and partner:** `PATCH /api/orders/bulk` with this one order's id, which doesn't re-price.
- **The rest:** delivery date and time window (`DatePicker` without the customer's blocked days, and the booking flow's `TimeWindowField`), driver, second driver, info for the driver, license plate, internal description, deviation (with its own description and prices for the custom one), discount, extra and express delivery. These go through `PUT /api/orders/[orderId]/website-items` with `handling`, which re-prices. Express and the deviation change the total, so while one of those is changed a debounced `dryRun` shows "Price after this change" (`WebsiteOrderPaymentSummary`) against what was paid. `handlingChange` decides what changed.
- **No GSM controls:** website orders are sent to GSM from the orders list, not from this panel.

The handling fields can still be saved on completed or invoiced orders.

Both are admin/owner only on the server, and anyone else gets an error message.

Moving into a status that needs a partner without one set asks for confirmation (`shouldPromptForPartner`), the same as elsewhere. After a save or send it calls `onChanged`, and `DashboardOrderModal` reloads the order and the list.

## Functions

| Function | Purpose |
|---|---|
| `buildWebsiteOrderAdminUpdate` | Turns the form into the bulk-update body, sending only what changed. An unchanged status is never re-sent, because re-sending e.g. "approved" would re-issue its payment link. Notes go out only with a status change, since the bulk update can't save notes on their own. Rejecting needs a comment. A partner can be set but not cleared. Returns `NO_CHANGES`, `NOTES_NEED_STATUS_CHANGE` or `REJECTION_COMMENT_REQUIRED` instead of a body when the form can't be saved. |

Calculator changes: the modal passes `pricingDraft` (the calculator unsaved discount, extra, partner minus/plus and lines set to 0). When there is one, Save sends it in the same `PUT` (`websiteItemsSaveBody`), so one button stores the panel and the prices.

Layout: `children` (the modal passes `WebsiteOrderAttachments`) render between the panel card and the Save row, so Save is the last thing in the left column. `besideSave` (the modal's red "Delete order", when allowed) sits left of Save in that row, and Save fills the rest of the width. The save message shows under the button.
