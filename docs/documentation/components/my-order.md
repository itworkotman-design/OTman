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
- `app/_components/site/pageComponents/myOrder/OrderProgressBar.tsx`: the steps from `lib/customerAccounts/orderProgress.ts` (Bestilling mottatt → Under behandling → Bekreftet → På vei → Fullført). Done = check with the time, current = pulsing ring, needs a change = orange "!", stopped = red cross (Kansellert / Ikke gjennomført), plus a note under the bar. When the order needs a change, the `rejectionNote` prop (the admin's rejection comment) is shown in that note as "Hva som må endres". Each step is a fifth of the width from `sm`, so a stopped order's bar ends where it stopped; vertical on phones.
- `app/_components/site/pageComponents/myOrder/orderProgressText.ts`: step labels, the notes under the bar, the status badge (`progressBadge`, the last step reached or stopped at) and step times (`formatStepTime`, Oslo time).
- `app/_components/site/pageComponents/myOrder/AutoRefresh.tsx`: `router.refresh()` every 60 s and when the tab comes back into view, so a status staff or GSM set shows up by itself. Off while the order page is being edited.
- `app/_components/site/pageComponents/myOrder/ContactUsCard.tsx`: the "Har du spørsmål om en bestilling?" box.
- `app/_components/site/pageComponents/myOrder/myOrderIcons.tsx`: the line icons these pages use.

## Responsibility

These pages are where homepage customers see and change their own order (see `docs/documentation/api/customer-orders.md`). They are linked from the order-received email and the login email. All pages are `noindex` and have `no`/`en` text.

**`CustomerOrderClient`** (the order page) shows:

- the back link and the profile menu, the order number with its status badge and when it was ordered, and **Endre bestilling** plus a **Ring for å avbestille** phone link (cancelling is by phone only — there is no cancel route). Both are hidden on a closed order.
- the progress bar
- **Tid og adresser**: date and time window, each pickup (with Butikk / Privatperson / Bedrift, place name, floor and lift, and the contact person on catalog orders) and the delivery address
- **Varer og tjenester**: a tile per product with its blue product icon (`ProductIcon`, from `findCustomerOrderProducts`) and count, and under it that product's delivery type and its own services (install, extras, return)
- **Kundeinformasjon**: name, phone, email, and the comment on its own row
- on the right: the total (incl. VAT), **Godt å vite** (`orderRules.ts` — what can still be changed and until when, in Oslo time, and that cancelling is by phone), and the contact box

Changing the password and logging out are in the profile menu (both pages).

The site navbar hides its dashboard **Login** button on every `/min-bestilling` page (`app/_components/site/navbarLogin.ts`), and the dashboard login page (`/login`) has a "Vil du se eller endre bestillingen din? Logg inn her i stedet" link to `/no/min-bestilling/logg-inn` for order customers who land there.

What **Endre bestilling** opens depends on the order:

- **White-goods order:** `WhiteGoodsBookingFlow` in `customer` mode (see `white-goods-booking-flow.md`).
- **Moving or quote order:** `CustomerOrderDetailsForm`, with contact details, notes, and the date and time window until the cutoff.

**`CustomerOrderEditFooter`** prices every change on the server (debounced `dryRun`). It shows the old and new totals incl. VAT (`previousTotalIncVat` / `totalIncVat`); within 24h of the job (`beforeCutoff` false) only the price of the added services (the difference), and nothing when that is 0. It saves with `shownTotal` set to that total. If the server answers `PRICE_CHANGED`, it updates the price and asks the customer to save again. While `blockedMessage` is set (a product without a pickup address), that message is shown and Save is disabled. `PRODUCT_WITHOUT_PICKUP` from the server shows the same kind of message. With `onOpenSummary` set and the order before the cutoff, the button opens the summary instead of saving, until `summaryOpen` is true (`customerEditPrimaryAction` in `customerEditPayload.ts`).

**`buildCustomerEditPayload`** sends only the parts that differ from the order as loaded. After the cutoff it never sends the date or the delivery, and sends the stops only when a pickup contact person changed: the stops as loaded with just the new contact persons (`withPickupContacts`).

Homepage moves: `CustomerOrderClient` opens `MovingRequestFlow` in its `customer` mode for `details.kind === "moving"`
(like `WhiteGoodsBookingFlow` for a delivery order). `customerEditPayload.ts` sends a move (`moving`) only when it changed,
and within 24h only its services, on the move exactly as loaded.

## Service requests
`kind: "service"` orders (`websiteOrderKind: "SERVICE"`) show a Service card (each service: icon, name, "What needs doing") and the job address as "Address". "Change order" opens `ServiceRequestFlow` in customer mode (`customer` prop, like `MovingRequestFlow`): every section but the customer type ("What needs doing" under the service, the comment under "Your details"). Within 24h of the job a service request can't be changed at all, so "Change order" is hidden (`permissions.editableAfterCutoff` false). Saved through `CustomerOrderEditFooter` (`service` in the payload). "Good to know" uses the service wording (`orderRules` with `kind: "service"`).
