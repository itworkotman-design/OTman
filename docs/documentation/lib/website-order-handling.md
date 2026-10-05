# Website order handling

## Source

- `lib/orders/websiteOrderHandling.ts`

## Responsibility

The fields of a homepage website order that only an admin handles, never the customer: driver, second driver, info for the driver, license plate, deviation fee, internal description, express delivery, discount (`rabatt`), extra (`leggTil`) and the partner minus/plus (`subcontractorMinus` / `subcontractorPlus`). The delivery date and time window are here too, so they can be changed without opening the booking editor; the editor can still change them as part of `details`. They're edited in `WebsiteOrderAdminActions` and saved with `PUT /api/orders/[orderId]/website-items` `handling`. Express, discount, extra and the deviation change the price.

"Don't send email" is not a website-order field. It only stops the notification email when a booking-app order is created, so it did nothing for a website order that already exists. The `Order.dontSendEmail` column stays, untouched by this panel.

## Functions

- `parseWebsiteOrderHandling(raw)` — trims and validates. Everything may be empty. The delivery date must be `YYYY-MM-DD` or empty; any day is allowed (no Sunday/holiday/past-date blocking for admins). Discount and extra must be amounts in kroner (comma or dot). The deviation must be a `DEVIATION_FEE_OPTIONS` label; only the custom one keeps its own prices and description. Errors come back per field (`INVALID_HANDLING`).
- `handlingOrderData(handling)` — the order columns (including `deliveryDate` / `timeWindow`), with empty text stored as `null`.
- `scheduleBookingDetails(stored, handling)` — copies the date and time window into `websiteBookingDetails` (`preferredDate` / `timeWindow`), which the editor and the paid-vs-now comparison read. Not an object → returned as is.
- `parseWebsiteOrderHandling(raw, stored?)` with `stored`: fields the save leaves out keep their stored value. The calculator sends only `rabatt`, `leggTil`, `subcontractorMinus`, `subcontractorPlus`; the "Handle order" panel sends everything else.
- `handlingFromOrder(order)` — the panel's starting values. A custom deviation's prices and description are read from the stored `pricingSnapshot`.
- `handlingChange(initial, next)` — `{ changed, affectsPrice }`. `affectsPrice` is true when express, discount, extra or the deviation changed, which triggers a price preview.
