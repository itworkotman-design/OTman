# From Product Cards

## Source

- `lib/booking/pricing/fromProductCards.ts`

## Responsibility

Builds calculator-ready product breakdowns from saved product cards, including shared XTRA delivery pricing, the over-100-km rule that zeroes non-XTRA base delivery lines, imported install or return selections that must stay active even when no delivery type is selected on the card, and read-only WordPress price snapshots that must preserve old prices exactly.

## Functions

| Function | Description |
| --- | --- |
| `findXtraSpecialOption` | Finds the active XTRA special option used for additional quantity pricing. |
| `shouldUseXtraDeliveryPricing` | Checks whether a card should use the shared XTRA delivery rate instead of the base rate. |
| `usesSharedDeliveryPricing` | Identifies delivery types that participate in shared indoor or first-step pricing. |
| `shouldZeroBaseDeliveryPrice` | Applies the long-distance rule that zeroes non-XTRA indoor, first-step, install-only, and return-only delivery lines over 100 km. |
| `getXtraDeliveryCardIds` | Picks which cards should switch from full delivery price to XTRA delivery pricing. |
| `findSelectedReturnSpecialOption` | Resolves the selected return special option for a card. |
| `findBaseProductOption` | Finds the default product option used when no install, return, or extra option applies. |
| `findDemontOption` | Finds the `DEMONT` option for products that support it. |
| `getAmount` | Resolves the effective quantity for a product card. |
| `getHoursInput` | Resolves the effective labor hours for labor products. |
| `appendCustomSectionItems` | Appends custom-section priced options to the current card breakdown. |
| `buildItemsForCard` | Builds all delivery, option, custom, and info lines for a single product card, including imported install and return selections that should remain priced even when delivery type is blank. |
| `buildProductBreakdowns` | Returns the final product breakdowns used by the booking calculator and pricing display, including read-only WordPress mismatch rows when a saved card carries an imported price snapshot. |
