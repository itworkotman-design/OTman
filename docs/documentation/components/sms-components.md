# SMS components (`app/_components/Dahsboard/booking/archive/`)

## `OrderSmsPanel.tsx`

| Export | Description |
| --- | --- |
| `OrderSmsPanel` | The SMS tab in `OrderEmailModal`. Recipient picker (Phone / Phone 2 / other number), template insert, message box with clickable `{placeholder}` chips (inserted at the cursor), a live placeholder preview and segment count, an amber warning naming any placeholder the text uses that this order has no value for, and Send. Below it, the order's SMS history with Sent/Delivered/Failed badges, the raw provider state, errors, and who sent each message (or "Automatic"). |
| `SmsSegmentInfo` | Small "N characters · N SMS" label, shared with the template editor. |

## `SmsTemplates.tsx`

| Export | Description |
| --- | --- |
| `SmsTemplatesSection` (default) | Section on the Settings page (`app/(User)/dashboard/settings/page.tsx`), below Pickup addresses and shown to OWNER/ADMIN only. Lists the automatic templates first (delivery day, then review request), each with its On/Off switch in the collapsible header. Every template shows its DB-stored name, and the collapsed row shows its description (or the text if there is none); name, description and text are editable for all templates. It also edits and deletes manual templates, and adds new ones. Clicking a placeholder chip appends it to the text. |
| `useSmsTemplates` | Loads `GET /api/sms/templates` while open. |
| `SmsPlaceholderLegend` | Re-exported from `SmsPlaceholderLegend.tsx` (see below). |
| `SmsModalShell` | Portal modal frame used by `SendSelectedSmsModal`. |

## `SendSelectedSmsModal.tsx`

| Export | Description |
| --- | --- |
| `SendSelectedSmsModal` | Opened from "Send SMS" on the selection bar. Template insert, message box and placeholder chips. While you type (debounced 400 ms) it calls the route with `preview: true` and lists the selected orders that have no value for a placeholder the text uses. After a confirm dialog it posts to `/api/orders/send-selected-sms`, then shows how many were sent and which orders failed and why. |

## `SmsPlaceholderLegend.tsx`

| Export | Description |
| --- | --- |
| `SmsPlaceholderLegend` | Clickable `{placeholder}` chips, shared by every SMS text box. Hovering a chip shows what it is filled in with. It lives in its own file so `OrderSmsPanel` can use it without a circular import through `SmsTemplates.tsx`. |
