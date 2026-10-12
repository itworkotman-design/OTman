# Website VAT

## Source

- `lib/booking/pricing/websiteVat.ts`

## Responsibility

VAT for homepage (website catalog) orders. The website price lists hold prices **ex. VAT**, like the booking app's, and orders store everything ex. VAT. A private customer sees and pays each line with 25% Norwegian VAT added, rounded to whole kroner. The order total is the sum of those lines, minus the discount and plus the extra, each incl. VAT the same way. So the lines a customer sees always add up to what they pay. Business customers see the ex-VAT prices.

## Functions

| Function | Purpose |
|---|---|
| `websiteInclVat(exVat)` | One amount → incl. VAT, rounded to whole kroner (half away from zero, so −50 → −63). |
| `websiteCustomerPrice(exVat, customerType)` | A price as the customer is shown it: private = incl. VAT, business = ex. VAT. |
| `websiteCustomerTotals(result)` | From a pricing result (`priceWebsiteOrder`): `{ totalExVat, totalIncVat, vat }`, with `totalIncVat` summed per line. Stored as the snapshot's `totalIncVat` (`buildOrderPricingSnapshot`'s `customerTotalIncVat`) and checked against the booking flow's `shownTotal`. |
| `websiteCustomerTotalDisplay({ totalExVat, totalIncVat, customerType })` | Which total leads: incl. VAT for private, ex. VAT for business. |

Also exports the `CustomerType` (`"private" | "business"`) and `VatDisplayTotal` types. Used by the white-goods booking flow (`WhiteGoodsBookingFlow`, `WhiteGoodsOrderSummary`, `WhiteGoodsProductCard`, `SizeBracketPicker`), the moving flow (`MovingRequestFlow`, `movingOrderPricing`), `priceWebsiteOrder`, the payment comparison (`paidOrderSnapshot`) and the admin calculator view. It replaces the old `vatDisplayTotal.ts`, which treated website prices as incl. VAT.
