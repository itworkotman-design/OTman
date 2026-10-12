# Order Totals

## Source

- `lib/orders/orderTotals.ts`

## Responsibility

Shared money helpers for order totals: discount/extra adjustments, reading the stored `pricingSnapshot`, and the amount to charge the customer.

**Homepage orders** (`websiteOrderKind` `WHITE_GOODS`) store ex. VAT like every other order. Their snapshot's `totalIncVat` is passed in as `customerTotalIncVat`, summed per line and rounded to whole kroner (`lib/booking/pricing/websiteVat.ts`), rather than 25% on the total. Such a snapshot is marked `vatBasis: "exVat"`; website orders without it predate the switch and are converted by `scripts/convert-website-orders-to-ex-vat.ts`. `getOrderChargeAmountIncVatNok` and `getPricingSnapshotCustomerVatTotals` treat every order the same: the snapshot's `totalIncVat`, else ex. VAT plus 25%.

## Functions

| Function | Purpose |
|---|---|
| `roundNok`, `clampOrderPrice`, `parseNokAdjustment` | Rounding to øre, clamping, and parsing a kr adjustment field. |
| `getOrderLinePriceTotals` | Customer and partner totals of priced order lines. |
| `getAdjustedCustomerTotal` / `getAdjustedSubcontractorTotal` | A subtotal after discount/extra (customer) or minus/plus (partner). |
| `getPricingSnapshotCustomerTotal` / `…SubcontractorTotal` / `…CustomerTotalIncVat` | Raw reads of the stored snapshot. |
| `getPricingSnapshotCustomerVatTotals` | The customer total incl. VAT and the VAT in it, correct for homepage orders too. Used by the MCP finance summary and orders list. |
| `getOrderChargeAmountIncVatNok` | What to charge through Stripe. |
| `getOrderRemainingBalanceIncVatNok` | What is still owed after payments. |
| `getPricingSnapshotNulledOrderExtraKeysFor…`, `getPricingSnapshotCustomDeviation…` | Admin calculator state stored in the snapshot. |
| `buildOrderPricingSnapshot` | Builds the snapshot stored on an order. |
