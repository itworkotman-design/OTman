# Website Order Calculator

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderCalculator.tsx`

## Responsibility

The right-column calculator in `WebsiteOrderModal`, laid out like the booking app's:

- **Customer card:** each product's lines (qty, code, label, price incl. VAT), the order extras, discount and extra rows, subtotal ex. VAT, VAT and the total. The Discount and Extra inputs sit under it.
- **Partner view (admins only):** the same lines at partner prices, the minus and plus rows and the partner total, with the Partner minus / Partner plus inputs.
- **Discount rule:** changing the discount sets the partner minus with `partnerMinusForDiscount`, like `BookingEditor`'s `handleAdjustmentsChange`. The admin can then type their own.
- **Live price:** while changed, a debounced `dryRun` of `PUT /api/orders/[orderId]/website-items` with just these four `handling` fields updates both cards and shows "Price after this change" (`WebsiteOrderPaymentSummary`) against what was paid. "Save prices" stores them; "Undo" resets.
- **Warnings:** a red note when the order re-priced now differs from its saved total, and the stored lines' "not covered" amount.

The booking app's "set line to 0" checkboxes aren't here.
