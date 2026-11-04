# lib/orders/staffEditCustomerEmail.ts

After staff save a change to a website order in the dashboard, the customer is told what changed.

| Function | Purpose |
|---|---|
| `sendStaffEditCustomerEmail({ orderId, companyId, before, actor })` | Compares the order before the save (`before`, an `OrderStateSnapshot`) with the order as saved (`diffOrderStates`) and sends the `order_updated` lifecycle email with the changes (`describeLineChange` / `describeDetailChange`, Norwegian), the new total incl. VAT (null when unpriced) and `byStaff: true` ("Vi har gjort endringer i bestillingen din…"). Returns `"sent"`, `"failed"`, `"no_changes"` (nothing the customer sees changed: lines, stops, dates) or `"no_email"`. Never throws — the save already happened. |

Called by `PUT /api/orders/[orderId]/website-items`, `moving-details` and `service-details` after a real save (never a dry run), unless the body has `skipCustomerEmail: true` — the "Ikke send e-post til kunden om endringen" checkbox beside Save (`SkipCustomerEmailCheckbox`, `EditTabParts.tsx`) in the Overview panel and the Edit order tabs. `website-items` also skips it when the same save sent a payment link email. The routes return the result as `customerEmail`; the dashboard adds it to the "Saved" message.

**One email when money is owed (Stripe):** if the saved order has Stripe payments and now costs more than was paid, the helper sends the payment request instead (`requestOrderBalancePayment` — what changed, the new total, the amount due and the pay link) and returns `"sent_payment_request"`; the dashboard says "Kunden har fått e-post om endringen med lenke for å betale mellomlegget". With fakturas, or when nothing more is owed, it's the plain "order updated" email.
