# Website Order Admin Footer

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderAdminFooter.tsx`

## Responsibility

The save bar of the booking flow when an admin edits an existing website order (`WhiteGoodsBookingFlow` with `admin`, rendered as `SteppedModal`'s `footer`).

- **Live preview:** every change to the products or details (keyed on their content) is priced with a debounced `PUT /api/orders/[orderId]/website-items` `dryRun`. `WebsiteOrderPaymentSummary` then shows the result against what was paid: paid so far, the new total, the difference, collect/refund/settled, and every changed line and stop.
- **Save order:** saves without emailing anyone.
- **Save & send payment link:** asks for confirmation first, and is disabled without a customer email.
- **Cancel:** closes the editor.

Nothing is required. A server refusal (an unknown product, or a filled-in field in the wrong format) shows as a message.
