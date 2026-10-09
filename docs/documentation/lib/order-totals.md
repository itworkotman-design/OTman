# Order Totals

## Source

- `lib/orders/orderTotals.ts`

## Responsibility

Shared money helpers for order totals: discount/extra adjustments, reading the stored `pricingSnapshot`, and the amount to charge the customer.

**Homepage orders are different.** A homepage catalog order (`websiteOrderKind` `WHITE_GOODS`) is priced in VAT-inclusive catalog prices. Its `priceExVat` and the snapshot's `customer.totalExVat` therefore already hold the incl.-VAT total. The snapshot's own `vat` / `totalIncVat` add 25% on top and must not be used for these orders. Read them through `getOrderChargeAmountIncVatNok` or `getPricingSnapshotCustomerVatTotals`.

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
