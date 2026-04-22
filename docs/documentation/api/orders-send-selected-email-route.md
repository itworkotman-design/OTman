# Orders Send Selected Email Route

## Source

- `app/api/orders/send-selected-email/route.ts`

## Responsibility

Sends one summary email for a set of selected orders, but blocks the send when the active company's outbound order emails are disabled, and logs failed outbound attempts back onto each selected order so the Alert Center conversation can show the failure reason.

## Functions

| Function | Description |
| --- | --- |
| `escapeHtml` | Escapes dynamic text before it is inserted into the generated email HTML. |
| `formatPriceNok` | Formats stored order totals as `NOK` strings for the summary email. |
| `formatDateNorwegian` | Formats stored `YYYY-MM-DD` values into `DD/MM/YYYY` for the summary email. |
| `formatTimeWindow` | Normalizes the stored delivery window for the summary email table. |
| `tableRow` | Builds one HTML table row for the selected-order summary email. |
| `buildFailedEmailLogBody` | Builds the plain-text failure body stored in `OrderEmailMessage` when the bulk send fails. |
| `formatOrderBlockHtml` | Builds the per-order HTML block included in the selected-order summary email. |
| `POST` | Validates access and payload, rejects the request when company order emails are disabled, renders the selected-order summary email, sends it, and writes `FAILED` outbound email messages plus email-attention flags back to each selected order when the provider rejects the send. |
| `logFailedSelectedOrderEmails` | Persists failed outbound email entries and marks the affected orders for email attention so admins can find the error in the Alert Center. |
