# `app/_components/site/pageComponents/OrderItemEditorClient.tsx`

## Purpose
Client component rendering the "Forgot something?" section on
`bestilling/endre/[token]` for an already-confirmed (paid) order. Fetches
the order's editable product cards + live catalog from `GET
/api/public/orders/[token]/edit-items`, lets the customer reconfigure each
product's delivery type/addons via the existing
`WhiteGoodsProductCard` (quantity shown read-only, no new-product picker),
then submits to `POST` on the same route. On success it shows the
previous/new total and, if the total increased, a link to
`/betaling/[token]` (the existing top-up payment flow) to pay the
difference — no live client-side price preview is computed while editing,
since the server is the only source of truth for the recomputed total.

If the order turns out not to be eligible (e.g. no catalog-priced items —
a Moving/special-goods/services order), the section quietly renders
nothing rather than showing an error, since the free-text
`OrderRequestChangeClient` alongside it already covers that case.

## Functions
- `OrderItemEditorClient({ token, locale })` — the only export. Internal
  phases: `closed` (a "Forgot something?" toggle button) → `loading` →
  `editing` (product cards) → `submitting` → `result` (totals + pay link),
  or `unavailable` (renders nothing).
