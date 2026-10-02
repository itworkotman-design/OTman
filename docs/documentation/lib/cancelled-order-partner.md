# Cancelled Order Partner

## Source

- `lib/orders/cancelledOrderPartner.ts`

## Responsibility

When an order is cancelled and has no partner (subcontractor), it gets a fixed
placeholder partner. The placeholder is configured by email in
`CANCELLED_ORDER_PARTNER_EMAIL` and resolved to that user's **active
membership in the order's company**. If the variable is unset, or the user
isn't a member of that company (e.g. the Neon dev DB), nothing happens. An
existing partner is never replaced.

Applied on every path that cancels an order:

| Path | How |
| --- | --- |
| Order modal (`PATCH /api/orders/[orderId]`) | `cancelledOrderPartnerData`, merged into the update and the history snapshot. |
| Bulk update (`PATCH /api/orders/bulk`) | One `findCancelledOrderPartner` lookup, then `updateMany` on the rows newly cancelled without a partner. Skipped when a bulk partner is chosen. |
| Payment-timeout sweep (`runPaymentTimeoutSweep`) | `cancelledOrderPartnerData`, merged into the cancel update. |
| Customer cancel link (`POST /api/public/orders/[token]/cancel`) | `findCancelledOrderPartner`, then a conditional `updateMany` that only writes where the partner is still empty. This keeps partner data out of the public token lookup. |

## Functions

| Function | Description |
| --- | --- |
| `findCancelledOrderPartner` | Resolves the configured email to `{ subcontractorMembershipId, subcontractor }` for a company, or `null`. The display name is the username, falling back to the email. |
| `cancelledOrderPartnerData` | Returns those fields when an order without a partner moves into `cancelled` (legacy aliases are normalized), and `{}` otherwise. |

## Legacy orders

Orders with a display id below `20000` (`PARTNER_TRACKING_MIN_DISPLAY_ID` in `lib/orders/partnerRequirement.ts`) were imported from before the app, and most of them have no partner. They are skipped everywhere: no daily alert, no partner dialog, and no cancelled-order placeholder.
