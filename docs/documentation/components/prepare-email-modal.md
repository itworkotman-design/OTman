# `app/_components/Dahsboard/booking/archive/PrepareEmailModal.tsx`

## Purpose
Confirmation modal for the booking archive's "Send prepare email to selected" button. `BookingOrdersView` loads the groups from `POST /api/orders/prepare-email-groups` and mounts the modal only while it's open, so its send state starts fresh each time.

## Functions
### `PrepareEmailModal(props)`
Shows one card per email that will go out. Each card has the recipient name, a Pickup address / Store tag, the To addresses, and a table with one row per pickup stop: order ID, the pickup address for that stop, and an "Extra pickup" tag on extra pickups (built with `buildPrepareEmailPreview`). An order with extra pickups therefore appears in each place's email. Groups that go to an extra pickup's own contact email are tagged "Extra pickup". Pickup stops with no reachable email are listed in a red "Not sent" section. **Send** posts each group to `POST /api/orders/send-prepare-email` one after the other. That route sends via Gmail with no reply thread. It keeps the email out of the order conversation, and marks each order with `prepareEmailSentAt` (violet marker in the alerts column) and a History entry. The modal marks each card Sent or Failed (with the reason). It then calls `onSent(["Name (n)", …])` for the groups that went out. The modal can't be closed while sending.

### `OrderRowsTable({ rows, t })`
The Order ID / Pickup address table used by each card and by the not-sent section.
