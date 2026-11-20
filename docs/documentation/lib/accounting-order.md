# Accounting order row

Source: `lib/integrations/accounting/accountingOrder.ts`

Turns an order into the row the accounting API returns: the booking export's money columns and who they belong to. Amounts must equal the export's, so an API import and a file import in OtmanAccounting give the same totals.

- `accountingOrderSelect` — the Prisma select the accounting orders route reads.
- `membershipUserLabel(user)` — an account's name: username, else email (as the archive shows it).
- `toAccountingOrder(order, { priceListNames })` — the row:
  - `status` normalized (`normalizeOrderStatus`); `deliveryDate` as stored (`YYYY-MM-DD`) or null.
  - `store` as the archive's "Store" column: the assigned store (`customerMembership`), else the creating account. (The archive also falls back to a legacy WordPress author; that's deprecated and left out here.) Always `{ id, name }` with a membership ID.
  - `partner` `{ id, name }` from `subcontractorMembershipId` / `subcontractor` (`id` null for a partner typed by name only), or null.
  - `priceExVatCents` / `partnerPriceCents` — `getEffectiveArchiveCustomerTotal` / `getEffectiveArchiveSubcontractorTotal` (`booking-archive-columns.md`) in øre.
