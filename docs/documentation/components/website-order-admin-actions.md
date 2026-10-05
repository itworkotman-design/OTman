# Website Order Admin Actions

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAdminActions.tsx`
- `lib/orders/websiteOrderAdminUpdate.ts`

## Responsibility

The "Handle order" panel in `WebsiteOrderModal`: everything on the order that only an admin handles, without opening the booking editor. One Save covers all of it:

- **Status, status notes and partner:** `PATCH /api/orders/bulk` with this one order's id, which doesn't re-price.
- **The rest:** delivery date and time window (`DatePicker` without the customer's blocked days, and the booking flow's `TimeWindowField`), driver, second driver, info for the driver, license plate, internal description, deviation (with its own description and prices for the custom one), discount, extra, express delivery and "don't send email". These go through `PUT /api/orders/[orderId]/website-items` with `handling`, which re-prices. Express and the deviation change the total, so while one of those is changed a debounced `dryRun` shows "Price after this change" (`WebsiteOrderPaymentSummary`) against what was paid. `handlingChange` decides what changed.
- **"Send to GSM" / "Update in GSM":** `POST /api/orders/send-to-gsm`.

The handling fields can still be saved on completed or invoiced orders.

Both are admin/owner only on the server, and anyone else gets an error message.

Moving into a status that needs a partner without one set asks for confirmation (`shouldPromptForPartner`), the same as elsewhere. After a save or send it calls `onChanged`, and `DashboardOrderModal` reloads the order and the list.

## Functions

| Function | Purpose |
|---|---|
| `buildWebsiteOrderAdminUpdate` | Turns the form into the bulk-update body, sending only what changed. An unchanged status is never re-sent, because re-sending e.g. "approved" would re-issue its payment link. Notes go out only with a status change, since the bulk update can't save notes on their own. Rejecting needs a comment. A partner can be set but not cleared. Returns `NO_CHANGES`, `NOTES_NEED_STATUS_CHANGE` or `REJECTION_COMMENT_REQUIRED` instead of a body when the form can't be saved. |
