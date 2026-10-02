# Partner Requirement

## Source

- `lib/orders/partnerRequirement.ts`

## Responsibility

Defines which order statuses expect a partner (subcontractor) to be set, and
provides the pure checks shared by the order modal, the bulk update bar and the
daily missing-partner cron.

## Functions

| Function | Description |
| --- | --- |
| `PARTNER_REQUIRED_STATUSES` | `failed`, `completed`, `invoiced`, `paid`. |
| `PARTNER_TRACKING_MIN_DISPLAY_ID` / `isPartnerTrackedOrder` | Orders below display id 20000 were imported from before the app and are skipped by every partner check. Orders without a display id yet (new orders) are tracked. |
| `requiresPartner` | True when a status (normalized, so legacy Norwegian aliases count) is partner-required. |
| `hasPartner` | True when an order has a partner membership id or a non-blank legacy partner name. |
| `shouldPromptForPartner` | True when the status changes into a partner-required status and no partner is selected. Drives `MissingPartnerDialog` in `BookingEditor`. |
| `findOrdersMissingPartner` | Filters a list of orders down to the ones with no partner. Used by the bulk update bar. |
