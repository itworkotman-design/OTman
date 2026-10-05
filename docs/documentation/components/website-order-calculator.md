# Website Order Calculator

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderCalculator.tsx`

## Responsibility

The right-column calculator in `WebsiteOrderModal`, laid out like the booking app's:

- **Customer card:** each product's lines (qty, code, label, price incl. VAT), the order extras, discount and extra rows, subtotal ex. VAT, VAT and the total. The Discount and Extra inputs sit under it.
- **Partner view (admins only):** the same lines at partner prices, the minus and plus rows and the partner total, with the Partner minus / Partner plus inputs.
- **Discount rule:** changing the discount sets the partner minus with `partnerMinusForDiscount`, like `BookingEditor`'s `handleAdjustmentsChange`. The admin can then type their own.
- **Live price:** while changed, a debounced `dryRun` of `PUT /api/orders/[orderId]/website-items` with just these four `handling` fields updates both cards and shows "Price after this change" (`WebsiteOrderPaymentSummary`) against what was paid. There is no Save button here: the changes go up through `onDraftChange` (a `WebsiteOrderPricingDraft`, or `null` when nothing changed), and the modal Save under "Handle order" stores them. "Reset prices" discards them. Only "Use new price" (re-pricing an outdated order) saves directly.
- **Warnings:** a red note when the order re-priced now (today's prices) differs from its saved total, and the stored lines' "not covered" amount.
- **"Use new price":** an admin button on that red note. After a confirm showing the old and new totals, it saves the order unchanged, which re-prices it at today's prices, like the booking app's "Use new price". What was paid is compared as usual.

The booking app's "set line to 0" checkboxes aren't here.

## "Set to 0" checkboxes

These work like the booking app's:
- **The boxes:** each priced line has a checkbox (product lines and order extras). On the customer card it zeroes the customer price; on the partner card, the partner price.
- **Customer and partner:** ticking a customer box ticks the partner box for the same line too, and unticking it unticks both. The partner box can be changed on its own and leaves the customer box alone.
- **Recalculation:** a click is priced straight away, with no typing delay.
- **When they show:** only while no discount or partner minus is set.
- **Discount inputs:** while any line is zeroed, the Discount and Partner minus inputs are hidden.
- **Clearing:** typing a discount or partner minus clears every zeroed line.
- **Saving:** choices are previewed and saved with the rest as `nulledLines`. "Reset prices" restores the saved choices.
