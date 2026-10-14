# Website Order Calculator

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderCalculator.tsx`

## Responsibility

The right-column calculator in `WebsiteOrderModal`, laid out like the booking app's:

- **Customer card:** ex. VAT, as stored. Website prices are ex. VAT like the booking app's. It shows each product's lines (qty, code, label, price), the order extras, and the discount and extra rows. Then a large **Total** (ex. VAT), with **VAT (25%)** and **Total incl. VAT** underneath. The incl.-VAT total is `customer.totalIncVat`: each line with 25% added, rounded to whole kroner, summed (`websiteVat.ts`), which is what the customer pays. The Discount and Extra inputs are ex. VAT and stored as typed. Partner amounts are shown unchanged.
- **Partner view (admins only):** the same lines at partner prices, the minus and plus rows and the partner total, with the Partner minus / Partner plus inputs.
- **Discount rule:** changing the discount sets the partner minus with `partnerMinusForDiscount`, like `BookingEditor`'s `handleAdjustmentsChange`. Both the discount and the subtotal are passed ex. VAT, so the share is the same. The admin can then type their own.
- **Live price:** while changed, a debounced `dryRun` of `PUT /api/orders/[orderId]/website-items` (or `previewEndpoint` — a move uses `moving-details`) with just these four `handling` fields updates both cards and shows "Price after this change" (`WebsiteOrderPaymentSummary`) against what was paid. There is no Save button here: the changes go up through `onDraftChange` (a `WebsiteOrderPricingDraft`, or `null` when nothing changed), and the modal Save under "Handle order" stores them. "Reset prices" discards them. The calculator never saves anything itself: its only request is the `dryRun` preview.
- **Warnings:** a red note when the order re-priced now (today's prices) differs from its saved total, and the stored lines' "not covered" amount.
- **"Use new price":** an admin button on that red note, shown when `priceChanges` (from website-details) lists a row whose price moved since the order was saved; a stored total that only differs from a fresh calculation doesn't trigger it. The calculator itself shows the order at the prices it was saved with. The button saves nothing. It sets `useNewPrice`, which counts as a change: the draft goes up through `onDraftChange` with `useCurrentPrices: true` (even with the amounts unchanged), and the "Price after this change" box previews today's price (its dry run sends `useCurrentPrices`) against what was paid. The modal's Save then stores it. "Reset prices" drops it again. A preview refused with `PRICES_OUTDATED` (an older order saved with outdated prices) says to press "Use new price" first. Under the note, `priceChanges` lists each line that would change ("Washing machine: Install – approved wet room 1 220 kr → 1 230 kr"). A separate red note names the products in `savedPricesIncomplete`.

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

## External pricing (Edit order tab)

With `externalPricing: { view, previewing }`, the calculator doesn't run its own dry-run or save. It shows the parent's latest `view` (falling back to `calculator`, the baseline its "changed" check compares against) and only reports its draft through `onDraftChange`. The "Price after this change" box is hidden in this mode, because the parent shows the payment comparison and saves everything together. "Use new price" still shows (same red note, compared with `currentPricesTotal`), but the parent owns the choice: `externalPricing.useNewPrice` says whether it's chosen (the note then hides), and the button calls `externalPricing.onUseNewPrice`.
