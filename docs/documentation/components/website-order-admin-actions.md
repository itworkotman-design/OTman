# Website Order Admin Actions

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAdminActions.tsx`
- `lib/orders/websiteOrderAdminUpdate.ts`

## Responsibility

The "Handle order" panel in `WebsiteOrderModal`: status, status notes and partner, plus "Send to GSM" / "Update in GSM". It only uses existing endpoints, none of which re-price the order:
- `PATCH /api/orders/bulk` with this one order's id;
- `POST /api/orders/send-to-gsm`.

Both are admin/owner only on the server, and anyone else gets an error message.

Moving into a status that needs a partner without one set asks for confirmation (`shouldPromptForPartner`), the same as elsewhere. After a save or send it calls `onChanged`, and `DashboardOrderModal` reloads the order and the list.

## Functions

| Function | Purpose |
|---|---|
| `buildWebsiteOrderAdminUpdate` | Turns the form into the bulk-update body, sending only what changed. An unchanged status is never re-sent, because re-sending e.g. "approved" would re-issue its payment link. Notes go out only with a status change, since the bulk update can't save notes on their own. Rejecting needs a comment. A partner can be set but not cleared. Returns `NO_CHANGES`, `NOTES_NEED_STATUS_CHANGE` or `REJECTION_COMMENT_REQUIRED` instead of a body when the form can't be saved. |
