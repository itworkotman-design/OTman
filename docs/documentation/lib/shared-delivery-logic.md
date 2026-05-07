# Shared Delivery Logic

## Source

- `lib/booking/pricing/sharedDeliveryLogic.ts`

## Responsibility

Resolves shared delivery behavior for booking product cards, including which cards should switch to XTRA pricing and which return-only card receives `RETURNIN`. `INSTALL_ONLY` participates in shared XTRA delivery selection and wins the main shared delivery slot when present.

## Functions

| Function | Description |
| --- | --- |
| `normalizeAutomaticXtraText` | Normalizes text used to match automatic XTRA options. |
| `isFirstStepAutomaticXtra` | Detects whether an XTRA special option is for first-step delivery. |
| `findAutomaticXtraSpecialOption` | Finds the active XTRA option for a delivery type. |
| `isTransportDeliveryType` | Detects delivery types that cover transport for `RETURNIN` logic. |
| `isSharedDeliveryPricingType` | Detects delivery types that participate in shared full-price versus XTRA delivery selection. |
| `isReturnOnlyDeliveryType` | Detects return-only delivery cards. |
| `usesTransportDeliveryPricing` | Checks whether a card covers transport for return-only pricing. |
| `usesSharedDeliveryPricing` | Checks whether a card can be the main shared delivery price. |
| `supportsSharedAutoDeliveryPricing` | Checks whether a product auto-delivery price participates in shared XTRA logic. |
| `getSharedDeliveryCandidate` | Builds a candidate for choosing the main shared delivery line. |
| `getMainSharedDeliveryCandidate` | Picks the main shared delivery candidate, giving install-only priority when present. |
| `getAutomaticXtraDeliveryCardIds` | Returns card ids that should use XTRA pricing instead of full delivery pricing. |
| `canApplyReturnOption` | Checks whether return options can apply for the selected delivery type. |
