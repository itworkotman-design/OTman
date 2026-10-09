# My order (customer pages)

## Source

- `app/(site)/[locale]/min-bestilling/logg-inn/page.tsx`: the login page. A logged-in customer is sent on to `next` (checked by `safeMyOrderPath`).
- `app/(site)/[locale]/min-bestilling/page.tsx`: "Mine bestillinger" — the profile menu, one `CustomerOrderCard` per order (also with a single order), then `ContactUsCard`.
- `app/(site)/[locale]/min-bestilling/[orderNumber]/page.tsx`: one order. Without a session it redirects to the login page with `next`.
- `app/_components/site/pageComponents/myOrder/CustomerLoginClient.tsx`: the login form and "forgot password" form.
- `app/_components/site/pageComponents/myOrder/CustomerOrderClient.tsx`: the order page.
- `app/_components/site/pageComponents/myOrder/CustomerOrderDetailsForm.tsx`: the edit form for moving and quote orders.
- `app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter.tsx`: the save bar of the booking flow's customer mode.
- `app/_components/site/pageComponents/myOrder/customerEditPayload.ts`: builds the save payload.
- `app/_components/site/pageComponents/myOrder/CustomerPasswordForm.tsx`: the change-password form, shown inside the profile menu.
- `app/_components/site/pageComponents/myOrder/CustomerProfileMenu.tsx`: the account badge (initial + email) at the top of both My order pages; opens a menu with "Innlogget som", **Endre passord** (the form opens in the menu) and **Logg ut**. Closes on outside click / Escape.
- `app/_components/site/pageComponents/myOrder/orderRules.ts`: the "Godt å vite" lines from the order's permissions (open, before the cutoff, can change products) and the cutoff.
- `app/_components/site/pageComponents/myOrder/CustomerOrderCard.tsx`: one order on the list — number, status badge, ordered date, delivery date and time window, pickup → delivery (with "+N more pickups"), delivery type and products, the progress bar and "Se detaljer" (changing and contacting are on the order page).
- `app/_components/site/pageComponents/myOrder/OrderProgressBar.tsx`: the steps from `lib/customerAccounts/orderProgress.ts` (Bestilling mottatt → Under behandling → Bekreftet → På vei → Fullført). Done = check with the time, current = pulsing ring, needs a change = orange "!", stopped = red cross (Kansellert / Ikke gjennomført), plus a note under the bar. Each step is a fifth of the width from `sm`, so a stopped order's bar ends where it stopped; vertical on phones.
- `app/_components/site/pageComponents/myOrder/orderProgressText.ts`: step labels, the notes under the bar, the status badge (`progressBadge`, the last step reached or stopped at) and step times (`formatStepTime`, Oslo time).
- `app/_components/site/pageComponents/myOrder/AutoRefresh.tsx`: `router.refresh()` every 60 s and when the tab comes back into view, so a status staff or GSM set shows up by itself. Off while the order page is being edited.
- `app/_components/site/pageComponents/myOrder/ContactUsCard.tsx`: the "Har du spørsmål om en bestilling?" box.
- `app/_components/site/pageComponents/myOrder/myOrderIcons.tsx`: the line icons these pages use.

## Responsibility

These pages are where homepage customers see and change their own order (see `docs/documentation/api/customer-orders.md`). They are linked from the order-received email and the login email. All pages are `noindex` and have `no`/`en` text.

**`CustomerOrderClient`** (the order page) shows:

- the back link and the profile menu, the order number with its status badge and when it was ordered, and **Endre bestilling** / **Avbestill bestilling** (after the cutoff "Be om å avbestille", which sends a request instead of cancelling). Both buttons are hidden on a closed order.
- the progress bar
- **Tid og adresser**: date and time window, each pickup (with Butikk / Privatperson / Bedrift, place name, floor and lift, and the contact person on catalog orders) and the delivery address
- **Varer og tjenester**: a tile per product with its blue product icon (`ProductIcon`, from `findCustomerOrderProducts`) and count, and under it that product's delivery type and its own services (install, extras, return)
- **Kundeinformasjon**: name, phone, email, and the comment on its own row
- on the right: the total (incl. VAT), **Godt å vite** (`orderRules.ts` — what can still be changed or cancelled and until when, in Oslo time), and the contact box

Changing the password and logging out are in the profile menu (both pages).

The site navbar hides its dashboard **Login** button on every `/min-bestilling` page (`app/_components/site/navbarLogin.ts`), and the dashboard login page (`/login`) has a "Vil du se eller endre bestillingen din? Logg inn her i stedet" link to `/no/min-bestilling/logg-inn` for order customers who land there.

What **Endre bestilling** opens depends on the order:

- **White-goods order:** `WhiteGoodsBookingFlow` in `customer` mode (see `white-goods-booking-flow.md`).
- **Moving or quote order:** `CustomerOrderDetailsForm`, with contact details, notes, and the date and time window until the cutoff.

**`CustomerOrderEditFooter`** prices every change on the server (debounced `dryRun`). It shows the old and new totals and saves with `shownTotal` set to that price. If the server answers `PRICE_CHANGED`, it updates the price and asks the customer to save again.

**`buildCustomerEditPayload`** sends only the parts that differ from the order as loaded. After the cutoff it never sends the date, the stops or the delivery.
