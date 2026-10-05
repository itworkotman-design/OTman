# Website Order Notes

## Source

- `lib/orders/websiteOrderNotes.ts`

## Responsibility

Builds the pickup, floor and lift lines that `POST /api/site/white-goods-order` writes into the order's description. Each item is on its own line.

The order also stores one combined floor and lift pair (`Order.floorNo` / `Order.lift`, see `costliestFloor`). GSM dispatch already prints that pair on every task ("Etasje - 5", "Heis - Nei", in `lib/integrations/gsm/buildOrderPayload.ts`). So the delivery floor and lift lines are left out when that pair says exactly the same thing, to avoid repeating them. They're kept when the stored pair came from the pickup instead (e.g. pickup -3, delivery 1).

## Functions

| Function | Purpose |
|---|---|
| `buildPickupNoteLines` | The pickup notes in a homepage order's internal description, used by order creation and by admin edits. There is one line per pickup stop, with a blank line between stops: `Pickup N - <Store/Private/Business>: <Name>, <Contact> / <phone> (<address>) - picking up: <products>`. Unknown parts are left out, and "picking up" only appears once the order is split across stops. A non-store stop with a floor gets `    *floor N, lift/no lift` under it. The delivery's floor and lift are added as a `Delivery` block only when the order's stored floor/lift pair (printed by GSM) doesn't already say it. |
| `buildWebsiteOrderNoteLines` | **Legacy.** The old note format, only used to recognise and replace it on older orders (`websiteOrderDetailsEdit.ts`). | Returns the note lines: pickup source, place name, pickup contact and phone, pickup floor and lift (not for a store pickup), and delivery floor and lift (only when not already shown by GSM). |
| `buildWebsiteOrderTextFields` | Splits the order's free text into its two fields. The customer's comment (the flow's last "comments" box) goes to `customerComments`. The note lines, then a blank line, then the multi-pickup lines, go to `description`. Empty values are stored as `null`. |
