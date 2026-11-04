# lib/orders/withdrawalConsent.ts

The right of withdrawal (angrerettloven) on homepage orders. Transporting goods on an agreed date has none (§ 22 m). A service (installing, disconnecting, dismantling, wall anchoring, packing, move-out cleaning) has 14 days, and a job done inside them can be withdrawn from at no cost unless the customer asked for it within the period (§ 22 a, § 24).

- `WITHDRAWAL_CONSENT_TEXT` — the checkbox wording (`no` / `en`) shown on the booking summary.
- `whiteGoodsOrderIncludesService(cards, products)` — true for any installation option, `demontEnabled`, or the extras `WALL_ANCHORING` / `DISMANTLE_DISP_STD` / `DISMANTLE_CAR_STD`. Unpacking, pallet pickup and returns count as transport.
- `movingOrderIncludesService(serviceCodes)` — true when any moving service is added.
- `needsWithdrawalConsent({ customerType, includesService })` — a service for a non-business customer.

Used by the white-goods and moving booking routes (422 `errors.withdrawalConsent` without `withdrawalConsent: true`; stores `Order.withdrawalConsentAt`), their summaries (`BookingTermsNotice`), and the order-received email, which repeats the request (§ 19).
