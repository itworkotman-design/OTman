# Missing Partner Dialog

## Source

- `app/_components/Dahsboard/booking/MissingPartnerDialog.tsx`

## Responsibility

A small confirm dialog that appears when an admin moves an order into
failed/completed/invoiced/paid without a partner. It renders through a portal at
`z-[60]`, above `OrderModal`, and catches Escape in the capture phase so the
order modal underneath stays open.

- **`mode="single"`** (used by `BookingEditor` on save): offers "Leave without
  partner" or "Choose partner". Choosing a partner shows a select, and Continue
  stays disabled until a partner is picked. The chosen partner is written to
  the form and submitted with the save.
- **`mode="bulk"`** (used by `BulkUpdateBar`): lists the selected order ids that
  have no partner. **Ignore** applies the bulk update anyway. **I'll fix it
  now** cancels it and keeps the selection.

Orders that are left without a partner are picked up by the daily
missing-partner cron (`docs/documentation/integrations/missing-partner-alerts-cron.md`).
