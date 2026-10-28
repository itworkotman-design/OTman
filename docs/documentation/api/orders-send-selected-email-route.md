# Orders Send Selected Email Route

## Source

- `app/api/orders/send-selected-email/route.ts`

## Responsibility

Sends one summary email for a set of selected orders to one or more selected recipients, writes an order-action history entry plus last-edited metadata for successful sends, blocks the send when the active company's outbound order emails are disabled, uses the configured Gmail send-as address in visible contact text and fallback logs, uses the configured public order email logo URL for the footer image, and logs failed outbound attempts back onto each selected order so the Alert Center conversation can show the failure reason.

The email HTML is built by `buildSelectedOrdersEmailHtml` in `lib/orders/selectedOrdersEmailHtml.ts` (see `lib/selected-orders-email-html.md`). It is sent through Brevo. The archive's prepare-orders emails use `/api/orders/send-prepare-email` (Gmail) instead.

## Functions

| Function | Description |
| --- | --- |
| `buildFailedEmailLogBody` | Builds the plain-text failure body stored in `OrderEmailMessage` when the bulk send fails. |
| `POST` | Validates access and payload, accepts either the legacy single `to` field or a `recipients` array, rejects the request when company order emails are disabled, renders the selected-order summary email, sends it, updates each selected order's last-edited metadata, writes a successful send action into order history, and writes `FAILED` outbound email messages plus email-attention flags back to each selected order when the provider rejects the send. |
| `logFailedSelectedOrderEmails` | Persists failed outbound email entries and marks the affected orders for email attention so admins can find the error in the Alert Center. |
