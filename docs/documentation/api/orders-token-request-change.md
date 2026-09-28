# `app/api/public/orders/[token]/request-change/route.ts`

## Purpose
Public endpoint backing `bestilling/endre/[token]` — a free-text message
box for anything the structured editor doesn't cover. A `"confirmed"`
order with catalog-priced items also gets a structured, self-service
alternative for the narrow case of "change delivery type/addons on an
existing product" — see `orders-token-edit-items.md` — but adding a new
product, or any other kind of change, still comes through here and stays
staff-mediated.

Eligible from `"rejected"`/`"approved"`/`"failed"` (the original behavior:
reverts status to `"processing"` so staff re-review before the customer can
pay) **and now also from `"confirmed"`** — this is the paid customer's
self-service entry point to request an addition. Critically, accepting a
request from a `"confirmed"` order does **not** revert its status to
`"processing"` (that would misrepresent an already-paid order as
unapproved/unpaid in the dashboard); it stays `"confirmed"`, the message is
still logged as an inbound `OrderEmailMessage` and flags
`needsEmailAttention`, and a `createOrderActionEvent` is logged instead of a
status-changed event.

## Functions
- `POST` — validates the message + order eligibility, writes the inbound
  email + (conditionally) the status change in one transaction, logs the
  appropriate event.
