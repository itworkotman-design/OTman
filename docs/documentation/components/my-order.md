# My order (customer pages)

## Source

- `app/(site)/[locale]/min-bestilling/logg-inn/page.tsx`: the login page. A logged-in customer is sent on to `next` (checked by `safeMyOrderPath`).
- `app/(site)/[locale]/min-bestilling/page.tsx`: "Mine bestillinger" — one `CustomerOrderCard` per order (also with a single order), then `ContactUsCard`.
- `app/(site)/[locale]/min-bestilling/[orderNumber]/page.tsx`: one order. Without a session it redirects to the login page with `next`.
- `app/_components/site/pageComponents/myOrder/CustomerLoginClient.tsx`: the login form and "forgot password" form.
- `app/_components/site/pageComponents/myOrder/CustomerOrderClient.tsx`: the order page.
- `app/_components/site/pageComponents/myOrder/CustomerOrderDetailsForm.tsx`: the edit form for moving and quote orders.
- `app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter.tsx`: the save bar of the booking flow's customer mode.
- `app/_components/site/pageComponents/myOrder/customerEditPayload.ts`: builds the save payload.
- `app/_components/site/pageComponents/myOrder/CustomerPasswordForm.tsx`: the change-password form.
- `app/_components/site/pageComponents/myOrder/CustomerLogoutButton.tsx`: the logout button.
- `app/_components/site/pageComponents/myOrder/CustomerOrderCard.tsx`: one order on the list — number, status badge, ordered date, delivery date and time window, pickup → delivery (with "+N more pickups"), delivery type and products, the progress bar, "Se detaljer" and a ⋯ menu (see/change, contact, call).
- `app/_components/site/pageComponents/myOrder/OrderProgressBar.tsx`: the steps from `lib/customerAccounts/orderProgress.ts` (Bestilling mottatt → Under behandling → Bekreftet → På vei → Fullført). Done = check with the time, current = pulsing ring, needs a change = orange "!", stopped = red cross (Kansellert / Ikke gjennomført), plus a note under the bar. Each step is a fifth of the width from `sm`, so a stopped order's bar ends where it stopped; vertical on phones.
- `app/_components/site/pageComponents/myOrder/orderProgressText.ts`: step labels, the notes under the bar, the status badge (`progressBadge`, the last step reached or stopped at) and step times (`formatStepTime`, Oslo time).
- `app/_components/site/pageComponents/myOrder/AutoRefresh.tsx`: `router.refresh()` every 60 s and when the tab comes back into view, so a status staff or GSM set shows up by itself. Off while the order page is being edited.
- `app/_components/site/pageComponents/myOrder/ContactUsCard.tsx`: the "Har du spørsmål om en bestilling?" box.
- `app/_components/site/pageComponents/myOrder/myOrderIcons.tsx`: the line icons these pages use.

## Responsibility

These pages are where homepage customers see and change their own order (see `docs/documentation/api/customer-orders.md`). They are linked from the order-received email and the login email. All pages are `noindex` and have `no`/`en` text.

**`CustomerOrderClient`** shows:

- the order summary
- what can still be changed, with the cutoff time in Oslo time
- **Change order** and **Cancel** buttons. After the cutoff, Cancel becomes "Ask to cancel", which creates a request instead of cancelling.
- the change-password form

When the order is closed, it only shows a "contact us" note. What **Change order** opens depends on the order:

- **White-goods order:** `WhiteGoodsBookingFlow` in `customer` mode (see `white-goods-booking-flow.md`).
- **Moving or quote order:** `CustomerOrderDetailsForm`, with contact details, notes, and the date and time window until the cutoff.

**`CustomerOrderEditFooter`** prices every change on the server (debounced `dryRun`). It shows the old and new totals and saves with `shownTotal` set to that price. If the server answers `PRICE_CHANGED`, it updates the price and asks the customer to save again.

**`buildCustomerEditPayload`** sends only the parts that differ from the order as loaded. After the cutoff it never sends the date, the stops or the delivery.
