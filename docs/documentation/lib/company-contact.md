# Company Contact

## Source

- `lib/content/companyContact.ts`

## Responsibility

The phone number customers call — notably to cancel an order, which is by
phone only (no self-service cancel anywhere: not in "My order", not in emails).

## Exports

| Export | Description |
| --- | --- |
| `OTMAN_PHONE` | `+47 402 84 977`, for display. |
| `OTMAN_PHONE_HREF` | The `tel:` link. |
| `CALL_TO_CANCEL` | "Vil du avbestille, ring oss på …" / "To cancel, call us on …" — used by `orderRules.ts`, "My order", the `/bestilling/avbryt/[token]` page (old emailed links) and the needs-change, payment-reminder and order-received emails. |
