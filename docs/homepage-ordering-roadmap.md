# Homepage ordering system — roadmap & gap analysis

**Written:** 2026-09-22. **Sources:** the booking tree diagram and product-option
spreadsheets in `Otman\Website\Delivery page` (not in this repo — a local desktop
folder used as design input), `docs/documentation/excalidraw/Website order path.excalidraw`,
and a full read-through of the live code (`app/_components/site/BookingModal/`,
`app/_components/site/TransportService/`, `app/api/site/`, `app/api/public/orders/`,
`prisma/schema.prisma`, `lib/orders/`, `lib/content/`).

This doc exists so the next work session (human or Claude) doesn't have to
re-derive "what's actually live vs. stubbed vs. dead" from scratch. Update it as
items ship — don't let it go stale the way `docs/documentation/components/service-window.md`
did (see §7).

---

## 1. The one-paragraph version

**White goods + furniture delivery/installation is the only genuinely complete,
end-to-end public flow** — tile picker → pricing → order → staff approve/reject →
Stripe payment → GSM dispatch → lifecycle emails → payment-timeout auto-cancel. It's
also the *only* flow with real price-list-driven pricing. Every other branch on the
booking tree (moving, services, parcel/pallet, other goods, special goods, rentals,
insurance, product accessories) is either a non-functional placeholder, a shallow
email-only lead form, or doesn't exist yet. There's also a fair amount of **dead
code and one orphaned data model** to clean up before piling more features on top.

---

## 2. Status per branch of the booking tree

Reference image: `Booking loğikas koks – Otman (updated)` in the Delivery page folder.
Black arrow = the diagram calls it done; red dashed = the diagram calls it
"to be developed". Column 3 below is the actual verified code state, which in a
few places disagrees with the diagram (noted).

| Branch | Diagram says | Actual code state |
|---|---|---|
| **Levering / montering → Hvitevarer** (White Goods) | ✅ done | ✅ **Done, live, real pricing + payment.** [`WhiteGoodsBookingFlow.tsx`](app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow.tsx) |
| **Levering / montering → Møbler** (Furniture) | ✅ done | ✅ **Done, live** — merged into the same flow this week (git: `c3c3b61`, `ca67d6b`, both Sep 21). Reached via the flow's "any other products?" step, not a separate homepage tile. One sub-case (`FurnitureProductSeed.needsImplementation`, "Other furniture") is intentionally a disabled manual-quote note, not bookable. |
| **Privat / Bedrift** toggle (all 3 top branches) | ✅ done | ❌ **Not found anywhere** in `BookingModal/`. No B2B/B2C selector, no VAT-display toggle. The furniture spreadsheet's own rules sheet explicitly calls for one ("Private frontend should show incl. VAT as primary... Business frontend should show ex VAT primary...") — not implemented. |
| **Flytting** (Moving) | ✅ done (feeds into Varekategorier) | ❌ **Placeholder only.** The 4th homepage tile opens a bare `SteppedModal` with hard-coded "Step 1" / "Step 2" dummy content ([`ServiceWindow.tsx:29-110`](app/_components/site/TransportService/ServiceWindow.tsx)); its "Continue to payment" button has no `onClick` at all. The old working version (`ServiceModal.tsx`, `formVariant: "transport"`, category `moving-relocation`) is commented out / unreachable. |
| **Services** | ✅ done (feeds into Varekategorier) | ⚠️ **Exists, but as a static lead form, not a modal, and not product-catalog-based.** `/tjenester` is a marketing page ending in a working form (`/api/public/manpower`, email-only, no DB row) for trade/staffing requests (electrician, carpenter, plumber, gardener, cleaner, IT, custom). This is closer to the tree's dashed "Andre tjenester" box in spirit than to a self-serve booking flow. |
| **Pakke / pall** (Parcel/pallet) | 🔴 to be developed | ❌ Not built. The white-goods spreadsheet's own rules sheet says pallet pricing was *deliberately removed* from that workbook ("Pallet... removed from Product options; will be handled elsewhere later"). |
| **Andre varer** (Other goods) | 🔴 to be developed | ❌ Not built, no data. |
| **Spesialvarer** (Special goods) | 🔴 to be developed | ❌ Not built, no data. |
| **Produkt-tilbehør** (product accessories, both categories) | 🔴 to be developed | ❌ Not built. No accessory concept anywhere in `Product`/`ProductOption`. |
| **Extra product options** (per install type) | 🔴 to be developed | ❌ Not built beyond what's already in the option groups. |
| **Extra services** | 🔴 to be developed | ❌ Not built. |
| **Insurance** | 🔴 to be developed | ❌ Not built. |
| **Rediger kode** (edit code) | 🔴 to be developed | ⚠️ **Partially exists, but as something narrower than "edit code" implies.** See §4 — there's a working non-expiring `actionToken` and a "request change" page, but it's a free-text message box, not structured line-item editing. |
| **Utleie** (rental) | 🔴 to be developed | ⚠️ Car rental exists (`bil-utleie/`, `VehicleBookingModal.tsx`) but is a shallow lead form: no DB row, no pricing engine, no order lifecycle — just an email. No non-vehicle rental (equipment, containers, etc.) exists at all. |
| **Andre tjenester** (other services, from START) | 🔴 to be developed | ❌ No code/content references this concept by name; closest existing thing is the `/tjenester` manpower form above. |
| **Payment** | 🔴 to be developed | ✅ **Actually already built and working**, just scoped to website Orders in general rather than to any one tree branch — see §4. The diagram undersells this; it's arguably the most complete piece after the delivery flow itself. |

---

## 3. Architecture findings — fix before extending

### 3a. Two parallel "moving/services" systems exist; one is fully dead
`ServiceModal.tsx` ([app/_components/site/TransportService/ServiceModal.tsx](app/_components/site/TransportService/ServiceModal.tsx),
~1170 lines) is commented out of `ServiceWindow.tsx` and rendered nowhere. It contains
a *mostly working* single-page form for `collection-pickup` (real product cards + live
calculator, posts to `/api/site/transport-request`) plus non-functional stubs for
`manpower` and `car-rental` (their submit handlers never actually submitted — they
just closed the modal). It also contains the only UI in the repo that captures
width/height/length/weight for a "custom transport" item — but only as free text into
an email, never into the pricing engine.

**Decision needed:** delete it, or mine it for reusable pieces (address/contact form
patterns, the dimension-picker UI) while building the real Moving flow. Recommend the
latter — the dimension-picker UI is a decent starting point for §5's custom pricing
work — then delete the dead file once superseded.

### 3b. `Request` / `RequestItem` Prisma models are orphaned
`prisma/schema.prisma:335-364` defines a lightweight lead-capture model with one API
consumer (`app/api/public/request/route.ts`), which nothing in the current frontend
calls. Every real website order — white goods, furniture, and even the still-reachable
`collection-pickup` branch of the dead `ServiceModal` — writes directly to `Order` /
`OrderItem` with `isWebsiteOrder: true` instead.

**Decision needed:** either (a) drop `Request`/`RequestItem` and formally standardize
on "everything website-facing is an `Order` with `isWebsiteOrder: true`, even simple
leads", or (b) actually start using `Request` for the genuinely-simple-lead branches
(manpower/services, rental enquiries) so the `Order` table doesn't get cluttered with
rows that were never priced. Given GSM dispatch, the dashboard review UI, and the
lifecycle-email pipeline are all already built around `Order`, **(a) is the lower-effort
path** — but it does mean every lead, even a one-line "I need an electrician",
becomes a full Order row. Worth a deliberate call either way rather than leaving both
patterns half-used.

### 3c. `app/api/site/white-goods-order` name no longer matches what it does
It now handles the merged white-goods + furniture order (and any future catalog added
to `WEBSITE_CATALOGS`). Consider renaming to `app/api/site/website-order` once a second
category outside white-goods/furniture needs it, to avoid the name actively misleading
whoever touches it next. Low priority, but do it before adding a 3rd/4th catalog rather
than after.

### 3d. Stale documentation
`docs/documentation/components/service-window.md` describes behavior (tile → link to
`/tjenester`) that no longer matches the code (tile → `SteppedModal`/`WhiteGoodsBookingFlow`).
Fix this doc alongside any `ServiceWindow.tsx` work — a stale per-file doc is worse than
no doc, since CLAUDE.md tells future sessions to trust it over spelunking. Also: the
entire customer-facing orchestration layer (`SteppedModal`, `WhiteGoodsBookingFlow` and
its subcomponents, the Stripe/webhook/timeout/lifecycle-email pipeline, the
`bestilling`/`betaling` pages, the dashboard website-orders review UI) has **no
per-file docs at all** — only the lower-level catalog/data files do. Worth a documentation
pass once this area stabilizes, per `docs/documentation/README.md`'s convention.

---

## 4. What's already built for payment & post-purchase (don't rebuild this)

This is more complete than the diagram implies, and more complete than the user's
framing ("we will also need to implement... a 1-time code") suggested going in —
worth knowing precisely what exists so new work extends it instead of duplicating it.

- **`Order.actionToken`** — a stable, non-expiring 32-char token stored per order.
  Not single-use; it's the same link reused across payment, cancel, and
  request-change pages for that order's whole lifetime
  ([`publicOrderAccess.ts`](lib/orders/publicOrderAccess.ts)).
- **Stripe checkout**: `POST /api/public/orders/[token]/checkout` creates a fresh
  Checkout Session per attempt (sessions are treated as disposable; the token is what
  persists). Webhook (`app/api/integrations/stripe/webhook/route.ts`) handles
  `checkout.session.completed` only, idempotently marks the order `confirmed`.
  Failed/abandoned checkouts just leave the order `approved`/payable, relying on:
- **Payment-timeout sweep** ([`runPaymentTimeoutSweep.ts`](lib/orders/paymentTimeout/runPaymentTimeoutSweep.ts),
  cron-driven): reminder email after 24h unpaid, auto-cancel after a further 3 days
  unpaid. Matches the "Lasts for 5 days" / "Lasts for 4 days" notes in the excalidraw
  diagram.
- **Lifecycle emails** (`lib/orders/customerLifecycleEmails.ts`): payment-request,
  rejected, payment-timeout-reminder — each with Pay / Request change / Cancel
  buttons built from the one `actionToken`. **There is no "order received" confirmation
  email at submission time** — the customer hears nothing until staff approve or
  reject.
- **"Edit" today = a free-text message**, not structured editing:
  `bestilling/endre/[token]` is a single textarea → `POST .../request-change`, which
  just flips the order back to `processing` for a human to re-edit internally and logs
  the note into the order's Email Center thread. `bestilling/avbryt/[token]` (cancel)
  is fully functional and does exactly what it says.
- **Dashboard review**: `app/(User)/dashboard/website-orders/` +
  `WebsiteOrdersActionBar.tsx` — bulk approve/reject with optional auto-email, plus
  manual resend of any lifecycle email. Real, complete, not a stub. **Open question
  (not yet verified in code):** does opening a website order in the dashboard reuse the
  same `OrderModal.tsx` as manually-created orders, or does it need its own read/edit
  surface given the different provenance (customer-submitted snapshot, approval
  workflow, payment state)? Check `app/_components/Dahsboard/booking/OrderModal.tsx`
  and `ReadOnlyOrderModal.tsx` before assuming either way — this directly answers the
  "existing order modal will need a copy to a website order modal" question from the
  original ask.
- **GSM dispatch**: no `isWebsiteOrder` branching at all in
  `lib/integrations/gsm/buildOrderPayload.ts` — website orders dispatch exactly like
  manually-created ones once approved. Good; no work needed here unless a future
  branch (moving, parcel/pallet) needs GSM task shapes the current builder doesn't
  support.

### The real gap: reopening a *paid* order to add items
Nothing above lets a customer who already paid go back in, add an item, and pay the
delta. Building this well means:
1. Deciding whether the *same* `actionToken` link should gain an "add items" mode once
   `status === "confirmed"`, or whether this needs a distinct, possibly time-boxed
   token (the existing token is permanent by design — reusing it post-payment is
   probably fine, but think about whether you want a customer able to do this
   indefinitely after delivery, or only in a window before the job happens).
2. A structured item editor (reuse `WhiteGoodsProductCard`/`ProductCardNew` patterns —
   they already exist for the initial booking) rather than another free-text box.
3. A second, additive Stripe charge for just the delta (new Checkout Session for
   `newTotal - alreadyCharged`, not a full re-charge) — `stripeAmountChargedCents`
   already exists on `Order` as a single field, so charging in installments needs it
   to become a running total or a per-charge log (maybe a new `OrderPayment` table,
   since GDPR/audit conventions elsewhere in this codebase favor an event log over
   mutating a single field — see `OrderEvent`).
4. An `OrderEvent`/`OrderNotification` so staff and GSM-facing dispatch data both
   reflect the addition — and a decision on whether adding items after a GSM task is
   already dispatched needs to update/re-send that task or just flag it for manual
   handling.
5. A customer-facing confirmation email for the addition (there's a whole
   `customerLifecycleEmails.ts` pattern to extend rather than invent from scratch).

This is real, non-trivial scope — plan it as its own project, not a quick add-on.

---

## 5. New capability: custom / weight / dimension pricing

**Confirmed: doesn't exist anywhere today.** `Product`, `ProductOption`,
`PriceListItem`, `PriceList` have no weight/height/dimension/volume/formula field;
`lib/booking/pricing/engine.ts` only does flat per-line unit pricing. The only UI that
ever captured raw dimensions (dead `ServiceModal.tsx`, "custom transport") fed them
into a plain-text email, never a calculation.

This is what "Pakke/pall", "Andre varer", "Spesialvarer", and honestly most of a real
"Flytting" (moving, priced by volume/rooms) flow all actually need. Recommend treating
this as **one shared pricing primitive**, not four separate one-off builds.

**More scaffolding already exists than it first looks like** — don't build these from
zero:
- `ProductType` already has `PALLET` and `LABOR` values (alongside `PHYSICAL`), with
  real flat-rate handling for both already live in the *internal* dashboard booking
  engine ([`fromProductCards.ts`](lib/booking/pricing/fromProductCards.ts),
  [`buildOrderItemsFromCards.ts`](lib/orders/buildOrderItemsFromCards.ts)) — e.g. a
  pallet product already prices "how many pallets" as a flat per-unit charge with an
  extra-pallet surcharge code. This is flat-per-unit, not weight-based, but it's a
  real head start for "Pakke/pall" specifically — extending it to the website flow
  (adding a `PALLET` entry to `WEBSITE_CATALOGS`) is far cheaper than a from-scratch
  weight-pricing engine.
- `PricingMode` already has a `REQUEST` value alongside `FIXED`, and it's already
  wired to a "Price on request" label in [`CatalogSection.tsx`](app/_components/CatalogSection.tsx)
  (internal dashboard catalog UI). This is exactly the "we can't auto-price this,
  someone needs to quote it" concept the quote-by-photo path below needs — it isn't
  wired into the public website flow or into `Order.status` yet, but the schema-level
  concept already exists and should be reused/extended rather than reinvented.

- **Schema**: a new pricing mode on `Product`/`PriceListItem` — e.g. `PricingMode`
  enum already exists (`prisma/schema.prisma:941`, check its current values) — extend
  it with something like `PER_KG`, `PER_M3`, or a generic `FORMULA` mode, plus fields
  for a base price + per-unit rate + weight/dimension brackets (the `ServiceModal`
  weight dropdown's bracket approach — "Under 10 kg" / "Under 30 kg" / etc. — is a
  reasonable UX precedent already validated by whoever built that form; tiered
  brackets are also simpler to price predictably than a continuous formula).
- **Where brackets can't give a confident price** (genuinely custom/oversized/special
  items — the "Spesialvarer" box), don't force an automatic price: build a
  **quote-by-photo** path instead — customer uploads photos + dimensions, order lands
  in the dashboard as `pending_quote` (not `processing`), staff sets a manual price,
  *then* the existing approve → email → Stripe pipeline takes over unchanged. This
  reuses 90% of the already-built pipeline and avoids inventing new payment/approval
  plumbing for the hard-to-automate cases.
- Needs S3 upload wiring for photos — the app already has an S3 storage provider
  configured for the archive package and blog images (`lib/docArchive/client.ts`,
  `BLOG_S3_*` env vars per CLAUDE.md) — reuse that pattern rather than a new one.

---

## 6. Moving ("Flytting") modal — needs a scoping decision before building

The diagram treats Moving as just another path into the same product-category system
as White Goods/Furniture, but real moving jobs (whole apartments/houses) don't map
well onto "pick a product, pick a delivery type" — that's why the old dead form used
free-text area/room descriptions instead. Before writing code, decide which model this
actually is:

- **Option A — inventory-based**: customer picks rooms/furniture pieces from a
  checklist (like the furniture catalog, but "what needs to move" not "what needs
  delivering") → auto-priced from item count + distance + floors. Reuses the existing
  furniture catalog data and pricing engine almost directly, plus the new
  weight/volume primitive from §5 for anything not in the furniture list.
- **Option B — quote-based**: customer describes the move (square meters, rooms,
  special items, address, date) → lands as `pending_quote` → staff prices it manually
  → same approve/pay pipeline. Much less upfront engineering, matches how the trade
  discovered in `/tjenester` already works, but customers don't get an instant price
  (worse conversion for a self-serve site).
- **Option C — hybrid**: instant price for a simple in-scope move (few rooms, no lift
  issues, standard access) using Option A's mechanics; anything outside that band
  falls back to Option B's quote flow automatically. This is probably the right
  answer long-term but is the most work — plan it as a v2 once A or B is live and you
  have real job data (the furniture spreadsheet's own rules sheet says "operational
  tuning can still be made after real-job data is accumulated", same logic applies
  here).

**Recommendation:** ship Option B first (fast, reuses 100% of the existing
approve/pay/dispatch pipeline, requires zero new pricing engine work), then evolve
toward A/C once there's real job data to calibrate item-count-based pricing against.

---

## 7. Services modal — needs a content decision, not just a build

"Services" (tree diagram) and `/tjenester` (live page) point at genuinely different
things depending on who you ask:
- The **diagram** implies Services sits alongside Delivery/Moving as a third path into
  the same Varekategorier (product categories) — i.e. maybe cleaning supplies,
  packing materials, something catalog-shaped.
- The **live `/tjenester` page and its content file** describe Services as
  **subcontracted trade labor** (electrician, carpenter, plumber, gardener, cleaner,
  IT) — fundamentally a staffing/outsourcing lead-gen product, not something with a
  fixed price list, which is why it's currently (correctly) just an email form.

These aren't the same thing, and the plan shouldn't assume which one "Services" means
without confirming. If it's the trades/staffing model (matches the live content),
the honest next step is *not* a priced self-serve modal — it's improving the existing
lead form (route it into `Request`/`Order` instead of email-only so staff can track it
in the dashboard, per §3b's decision) rather than building pricing UI for something
inherently quote-based. If there's a *third*, catalog-shaped "Services" concept the
diagram intends (e.g. "junk removal", "packing service" as a bookable line item),
that needs its own product/price-list entries like white goods has, and then it's just
another catalog added to `WEBSITE_CATALOGS` — cheap, once the content is defined.

---

## 8. Rental — vehicles work as a lead form; nothing else exists

Current `bil-utleie` flow (`VehicleBookingModal.tsx` → `/api/public/vehicle-booking`)
is deliberately shallow: no DB row, no pricing engine beyond a client-side display
estimate, no order lifecycle. If "Utleie" in the diagram means *equipment* rental
(vans, trailers, tools) rather than vehicles, that's entirely new scope — no code
anywhere references it. Two independent questions to resolve before building:
1. Should vehicle rental itself graduate from lead-form to a real priced `Order` (so
   it gets the approve/pay/dispatch pipeline for free)?
2. Is equipment rental in scope at all right now, or is it aspirational per the
   diagram's dashed box? If in scope, it's a new catalog concept — a rental item
   needs a date-range price (day rate × days), which the current flat per-unit
   `PriceListItem` model doesn't express; it'd need the same schema extension work as
   §5's dimension pricing, just with date-range instead of weight as the multiplier.

---

## 9. Product accessories, extra services, insurance

All three are currently just dashed boxes with zero backing data or schema. They're
smaller, more mechanical additions than the items above — likely each one is a new
`ProductOption` category or a new order-level `PriceListSpecialOption` type
(`SpecialOptionType` enum already exists and already backs order-level extras like
express delivery — check whether insurance/extra-services fit that existing pattern
before inventing a new model). Lower priority than the structural decisions above;
sequence these *after* §3's cleanup and §5's pricing primitive, since accessories for
a category that doesn't have real pricing yet (parcel/pallet, special goods) have
nothing to attach to.

---

## 10. Ideas worth considering (not requested, but adjacent)

- **Abandoned-cart recovery**: the multi-step `SteppedModal` flow has no persistence —
  closing the modal loses all progress. Even a localStorage draft-save (resume on
  reopen) would likely lift completion rate; a magic-link "email me my cart" option
  is the stronger version once you have the customer's email from an early step.
  If the customer has entered an email at all before abandoning, a scheduled
  "you left something in your cart" email reusing the lifecycle-email pipeline is a
  strong conversion lever with a lot of the plumbing already built.
- **Order-received confirmation email**: noted as a gap in §4 — currently the customer
  gets zero email between submission and staff approve/reject, which for anything
  slower than instant review (nights/weekends) reads as "did this even go through?".
  Cheap to add, reuses the existing email pipeline.
- **Saved customer identity across visits**: nothing today lets a repeat customer skip
  re-entering name/phone/address. Given `CustomPickupAddress`/`UserCustomPickupAddress`
  already exist for the *internal* dashboard side, a lightweight "remember me on this
  device" (cookie + phone/email lookup, not a full account system) could prefill the
  contact/address steps for returning website customers without needing real auth.
- **SMS alongside email** for payment reminders/approval — email-only today; given
  Gmail API is already wired for order threads, this would be a genuinely new
  integration (Twilio or similar), so only worth it if email open rates are a known
  problem.
- **Consistent `pending_quote`-style status** as a first-class `Order.status` value —
  §5 and §6 both end up wanting "we received this, a human needs to price it before
  the customer can pay" as a distinct state from the current `processing` →
  `approved`/`rejected` binary. The schema already has the underlying *concept*
  (`PricingMode.REQUEST`, currently only wired to an internal "price on request"
  label — see §5) — extending that concept to a matching `Order.status` value is a
  small, well-precedented change rather than a new idea, and should happen once,
  generically, rather than being reinvented per-branch.

---

## 11a. Progress log

- **2026-09-22 — Step 1 (Cleanup) done.** Decisions made: keep `ServiceModal.tsx`
  in place for now (mine it when building the real Moving flow in step 3, delete
  once superseded); dropped `Request`/`RequestItem` entirely, standardizing on
  `Order` + `isWebsiteOrder` for all website-originated records going forward.
  Changes: removed the `Request`/`RequestItem`/`RequestStatus` models and the
  `Service.requestItems` back-relation from `prisma/schema.prisma`; deleted the
  orphaned `app/api/public/request/route.ts`; added migration
  `prisma/migrations/20260922130000_drop_request_models/`; fixed the stale
  `docs/documentation/components/service-window.md`. Verified: `npx prisma generate`,
  `npm run typecheck`, `npm run test` all clean (pre-existing, unrelated failures —
  a missing-`ARCHIVE_DATABASE_URL` suite and one flaky membership-role test — confirmed
  present on `main` before this change too, via `git stash`). `Category`/`Service`
  models and `lib/catalog.ts`/`CatalogSection.tsx` were left untouched — they're a
  separate, currently-unrendered catalog concept (has `pricingMode`/`priceCents`
  fields) that's actually a plausible fit for the §7 Services-catalog question later;
  worth revisiting there rather than acting on now.

- **2026-09-22 — Step 2 (Privat/Bedrift VAT display toggle) done.** Scoped to
  "totals only" per decision: the toggle changes which VAT total (incl. or ex.)
  is shown as primary/secondary in the sticky per-step `WhiteGoodsOrderSummary`
  sidebar and the final summary step; the ~20 individual per-option prices shown
  while shopping (delivery type, install options, extras) are unchanged, still a
  single ex-VAT number, same as before. New: `lib/booking/pricing/vatDisplayTotal.ts`
  (`getVatDisplayTotal`, TDD'd — test written and confirmed failing before the
  implementation) and `CustomerTypeToggle.tsx`. Wired `customerType` as lifted
  state in `WhiteGoodsBookingFlow.tsx`, default `"private"`. Both totals
  (ex-VAT/incl-VAT) were already computed engine-wide by
  `lib/booking/pricing/engine.ts` (`totals.vat = totalExVat * 0.25`) — this only
  needed a "which one is primary" decision layer, not a new VAT calculation.
  Verified: new unit tests pass, full `typecheck`/`lint`/`test` pass (same
  pre-existing unrelated failures as step 1, no new ones, no new lint issues on
  touched files). Added docs for the 3 touched/new component files, plus (per
  CLAUDE.md convention) for the pure-logic module.
  **Not yet done, deliberately out of scope for this step**: this only covers
  the white-goods/furniture flow (the only flow with real pricing today) — once
  Moving/Services/etc. get real pricing (later steps), they'll need the same
  `customerType` state + `getVatDisplayTotal` wiring, not a new mechanism.

- **2026-09-22 — Step 3 (Moving) done — revised mid-step from Option B
  (quote-only) to size-bracket priced, on your correction that Moving needed
  real Stripe payment and pricing derived from space size.** What shipped:
  - **Pricing**: a new `WEBSITE_MOVING` price list, one bare `Product`
    (`MOVING_BY_SIZE`, all delivery-type/install-option/extras flags off) with
    5 `ProductOption` rows, one per size bracket (`lib/content/movingCatalog.ts`).
    Seeded via `npm run seed:moving-catalog` → `lib/content/seedMovingCatalog.ts`
    (TDD'd). **Deliberately not `seedWebsiteCatalog.ts`** — that helper (and
    the `WhiteGoodsProductSeed` shape it takes) always builds a
    delivery+install+extras product, which doesn't fit a flat "pick one
    bracket" price. **Deliberately not in `WEBSITE_CATALOGS`** either — that
    registry is for catalogs that plug into the shared multi-select
    product-card flow (white goods/furniture's "any other products?" step);
    Moving isn't that, it has its own bespoke UI.
  - **Prices are placeholders (0 kr), by design, per your architecture
    choice** ("new Product in the catalog system" over hardcoding): staff set
    real NOK figures via the existing `/dashboard/booking/editPrices` admin
    (Owner/Admin-only, already supports creating/pricing any product with zero
    deploys) — same as onboarding any other new product there. Re-running the
    seed script is safe and won't overwrite whatever staff have since entered
    — `PriceListItem` prices are only set on first `create`, never touched on
    `update` (locked in with a test), unlike white-goods/furniture's reseed
    behavior which *does* refresh prices from their spreadsheet source on
    every run — deliberately different because Moving's source of truth is
    the dashboard, not a spreadsheet. **This must happen before launch** — the
    flow is fully functional but will show/charge 0 kr for every bracket
    until someone does this.
  - **Fetching**: a small dedicated public route,
    `GET /api/site/moving-request/catalog` (TDD'd), backed by a shared
    `lib/content/getMovingCatalog.ts` helper (also TDD'd) used by both that
    route and the submission route's server-side price re-resolution — one
    query, one source of truth. Deliberately not the generic
    `/api/booking/catalog` (env-gated to exactly one public price list via
    `PUBLIC_CATALOG_PRICELIST_ID`, already spoken for) or
    `lib/booking/catalog/getBookingCatalog` (returns *every* active product
    in the DB regardless of price list — the exact problem the
    "Catalog not price-list-scoped" pattern already works around elsewhere;
    querying this one price list's own items directly sidesteps it entirely).
  - **Submission** (`POST /api/site/moving-request`, rewritten, TDD'd): the
    client sends a `sizeOptionCode`; the route re-resolves its real price
    server-side (never trusts a client-sent price), creates a **priced**
    `Order` (`isWebsiteOrder: true`, real `priceExVat`/`priceSubcontractor`,
    `status: "processing"`) + one `OrderItem`. No new `Order.status` value or
    schema change.
  - **Stripe**: no new payment code at all — `/api/public/orders/[token]/checkout`,
    the webhook, and the whole approve → email → pay pipeline already work
    generically for any priced, approved `isWebsiteOrder`. Getting a real
    price onto the order (above) was the entire gap; a staff member still
    approves before the customer gets a payment link, same gate as every
    other website order.
  - **UI** (`MovingRequestFlow.tsx`, rewritten): fetches live prices on open,
    size brackets render as priced choice buttons instead of a plain
    dropdown, and the final step reuses step 2's `CustomerTypeToggle`/
    `getVatDisplayTotal` for a consistent Privat/Bedrift total display — this
    also closes the "not yet done" item noted at the end of step 2's own log
    entry.
  - Wired into `ServiceWindow.tsx` via a `MOVING_SERVICE_ID` constant
    alongside `WHITE_GOODS_SERVICE_ID`, replacing the dead placeholder branch
    for that tile only.
  - Verified: all new/updated tests pass (28 across 5 files — seed, catalog
    helper, catalog route, submission route), full `typecheck`/`lint`/`test`
    clean (same pre-existing unrelated failures, no new ones). Docs
    added/updated for every new file plus `service-window.md`.
  - **Deliberately not done / known follow-ups**: (1) real size-bracket
    prices — see above, this is the one blocking item before launch; (2) no
    distinct "pending quote"/"needs pricing" status or dashboard visual cue —
    a 0-kr Moving order (before staff price it) looks identical to a normal
    "processing" order today, so bulk-approve could in principle wave one
    through unpriced; worth a small dashboard affordance
    (flag `priceExVat === 0 && isWebsiteOrder`) if this becomes a real
    footgun; (3) email required here, unlike `white-goods-order` (optional
    there) — deliberate, this flow's only outcome is emailing a payment link;
    (4) `ServiceWindowContent.ts`'s `items[1].id` being `"moving-relocation"`
    while its own title/content describe an unrelated legacy tile is
    confusing but left as-is (documented directly in `ServiceWindow.tsx`);
    (5) still flat brackets, not true inventory/room-based pricing
    (Option A/C) — future work once real job data exists to calibrate it.

- **2026-09-22 — Step 4 (post-payment "add items") done.** Confirmed
  scope up front via a clarifying question, since this is
  payment-correctness-sensitive: chose a new `OrderPayment` ledger table
  (full per-charge history) over accumulating a single scalar field, for
  proper support/refund/audit traceability.
  - **Design**: rather than building a whole new public multi-item picker,
    reused what already existed almost everywhere — staff add the extra
    item(s) to the order using the **existing internal order editor**
    (verified it isn't blocked by order status — a `"confirmed"` order was
    already freely editable there, zero changes needed); the customer's
    entry point is the **existing "request change" page**, extended to work
    post-payment; the **existing `betaling/[token]` payment page** gained a
    new state — "confirmed, but there's an unpaid balance" — computed as
    current order total minus the sum of every `OrderPayment` row.
  - **Schema**: new `OrderPayment` model (id, orderId, companyId,
    stripeCheckoutSessionId **unique** — this is the idempotency key,
    stripePaymentIntentId, amountChargedCents, createdAt). `Order`'s existing
    single-scalar payment fields are kept in sync as a "latest/total"
    convenience snapshot for existing readers, but `OrderPayment` is now the
    source of truth for "how much has actually been paid."
  - **The landmine this caught**: the original webhook's idempotency check
    was `if (order.status === "confirmed") return` — status-based. That
    would have **silently dropped every top-up payment's webhook event**
    (order already confirmed → early return, no OrderPayment row, no
    accumulated total, no event log) — a real money-losing bug if shipped
    as-is. Rewrote it keyed on the Stripe checkout session instead
    (`recordOrderPayment`'s `P2002`-based idempotency), which correctly
    handles the original payment, a top-up payment, and Stripe webhook
    redelivery, all as the same code path.
  - **Webhook** (`app/api/integrations/stripe/webhook/route.ts`, rewritten,
    TDD'd): records the `OrderPayment`, recomputes the accumulated total,
    confirms status only on the first payment, logs a status-changed event
    (first) or action event (top-up) accordingly.
  - **Checkout route** (rewritten, TDD'd): now charges the full total for a
    normal payment or just the remaining balance
    (`getOrderRemainingBalanceIncVatNok`, new, TDD'd) for a top-up, gated by
    a new `isTopUpPayable` helper alongside the existing `isOrderPayable`.
  - **Payment page**: new branch for "confirmed with an outstanding
    balance" — shows amount paid / remaining balance / a pay button for just
    the difference.
  - **Request-change route + page** (`bestilling/endre/[token]`, TDD'd):
    now reachable from `"confirmed"` too. Critically, accepting a request
    from a confirmed order does **not** revert status to `"processing"`
    (would misrepresent a paid order as unapproved) — stays confirmed, logs
    an action event instead of a status-changed one.
  - **Closed a gap this step's own design surfaced**: making the
    request-change link reachable post-payment was pointless without a way
    for the customer to *find* that link — a confirmed order sent no
    customer-facing email at all before this (the gap flagged back in §4's
    original notes). Added a 5th thing: an `order_confirmed` lifecycle email
    (TDD'd), auto-sent by the webhook on the first confirmation only
    (best-effort, never fails the webhook), containing the request-change
    link. Also added a 4th lifecycle-email kind, `balance_due` (TDD'd), for
    staff to manually notify a customer once they've added items to a paid
    order — both wired into the dashboard's existing "Customer emails"
    button group (`WebsiteOrdersActionBar.tsx`) and the generic
    `LIFECYCLE_EMAIL_KINDS`-driven send route, so no separate endpoint work
    was needed for either.
  - Verified: 40 new/updated tests across 8 files (all TDD'd — including a
    dedicated test proving the webhook accumulates rather than overwrites on
    a top-up, and one proving the request-change route never reverts a
    confirmed order's status), full `typecheck`/`lint`/`test` clean (1085
    passing; same pre-existing unrelated failures, no new ones). Docs added
    for the 4 files with the most complex new logic (`orderPayments.ts`,
    the Stripe webhook, the checkout route, the request-change route).
  - **Deliberately not done / known follow-ups**: (1) no structured
    public item-editor — adding items is still staff-mediated via the
    internal order editor, not a public UI; a real self-service item-adder
    is future work if this staff-mediated flow proves too slow in practice;
    (2) doc debt remains on `publicOrderAccess.ts`, `orderTotals.ts`,
    `customerLifecycleEmails.ts`, `sendCustomerLifecycleEmail.ts`, the
    `betaling`/`bestilling/endre` pages, and the dashboard action bar/page —
    all touched this step but not all individually documented, given how
    much surface area this step already covered; (3) no automated test
    exists yet proving the *whole* multi-step flow end-to-end against a
    real (non-mocked) database — each piece is unit-tested in isolation.

- **2026-09-22 — Step 5 (Pakke/pall) done — partial, "Andre varer"/
  "Spesialvarer" and the generic weight/dimension pricing primitive
  explicitly NOT built this step.** Investigated before building: found the
  dead `ServiceModal.tsx`'s "collection-pickup" branch pointed at a
  `TRANSPORT_PACKAGE_PRICELIST_ID` that **doesn't actually exist in the
  local dev DB** (a dangling placeholder — verified directly against the
  database, not assumed) — so there was no hidden real pricing data to
  recover there, just a product-name list
  (`transportPackageTypes`: Pose/Esker/Kolli/Halvpall/Pall/Konvolutt/
  Ferskvarer-mat) and a reusable UI precedent.
  - **Placement decision** (asked, since it's a real UX call): merge into
    the existing White Goods/Furniture shared cart (matches the original
    tree diagram) rather than give it its own tile like Moving. This meant
    `WhiteGoodsProductCard.tsx`/`WEBSITE_CATALOGS` needed to actually support
    a delivery-only product shape — confirmed furniture's own "Mattress"-style
    entries (delivery type only, zero install options) already prove this
    shape works in that exact pipeline, so **no `WhiteGoodsProductCard.tsx`
    changes were needed at all** — this shipped as pure catalog-data
    addition, the cheapest of every option considered.
  - **New catalog**: `WEBSITE_PARCEL_PALLET` price list, 7 delivery-only
    products (`lib/content/parcelPalletCatalog.ts`), registered in
    `WEBSITE_CATALOGS` (now 3 catalogs, still offered white goods → furniture
    → parcel/pallet). Seeded via `npm run seed:parcel-pallet-catalog` — same
    "prices are placeholders" pattern as Moving/every prior step.
  - **A second landmine caught before it shipped**: initially wrote a thin
    wrapper around the existing `seedWebsiteCatalog()` (reusing it exactly
    like furniture/white goods do) — but that function unconditionally
    overwrites prices on every reseed (correct for furniture/white goods,
    whose prices come from a spreadsheet). Since these are staff-entered
    placeholders instead, that would have silently reset real prices back to
    0 on any future reseed. Rather than duplicate the seeding logic (like
    Moving's dedicated seed function did), extended `seedWebsiteCatalog()`
    itself with an opt-in `preservePricesOnReseed` flag (default `false`,
    furniture/white goods unaffected — their own tests still pass unchanged)
    — **and while building the test for it, caught a second, non-obvious
    part of the same landmine**: these delivery-only products have zero
    `ProductOption`/`PriceListItem` rows at all (no install options to seed),
    so their actual price lives entirely in `Product.deliveryTypes` JSON —
    meaning protecting `PriceListItem` alone (as first implemented) would
    have protected nothing real for this specific catalog. Fixed to also
    exclude `deliveryTypes` from the product-level update when the flag is
    set.
  - Verified: 4 new/updated tests (seed wrapper, TDD'd) plus fixed 3
    pre-existing `websiteCatalogs.test.ts` assertions that hardcoded "exactly
    2 catalogs" (expected, correct breakage from adding a real 3rd one, not
    a regression) — full `typecheck`/`lint`/`test` clean, 1089 passing.
    Ran the seed against the local dev DB and confirmed the catalog is live.
  - **Deliberately not done this step**: (1) "Andre varer" (other goods) and
    "Spesialvarer" (special goods) — per §5's original plan these need a
    quote-by-photo flow (S3 upload, a `pending_quote`-style order state, a
    staff photo-review UI), which is new infrastructure with its own real
    security/cost surface (public file uploads), not a small extension of
    what exists — treating this as its own scoped step rather than folding
    it in here; (2) the real `PALLET` per-quantity pricing discount (see the
    "second landmine" note above) — "Pall"/"Halvpall" charge a flat rate per
    unit today, not the internal dashboard's real 2nd-pallet-discount
    behavior; (3) no generic `PricingMode` extension (`PER_KG`/`PER_M3`/
    formula-based) was built — turned out unnecessary for this step, since
    flat per-product catalog pricing (the same mechanism as everything else)
    covered Pakke/pall's actual "how many of this flat-rate thing" need; a
    real formula-based primitive is still not built and would still be needed
    for any future genuinely weight/dimension-*priced* (not just
    weight/dimension-*labeled*) category.

- **2026-09-22 — "Andre varer"/"Spesialvarer" quote-by-photo flow done** —
  the piece split out of step 5 for its own scoping, now built. Two
  decisions confirmed up front, since this is the one genuinely new public
  attack surface added across this whole roadmap (every other upload path in
  this app — order attachments, blog images, archive docs — requires a
  logged-in dashboard session; nothing existing was safe to copy):
  1. **Build real public photo upload** (over a text-only, no-upload
     alternative that would've reused Moving's flow exactly with zero new
     security surface — the lower-risk option, not chosen).
  2. **No CAPTCHA for now** — ships with honeypot + per-IP rate limiting +
     real file-content validation as the defense layers; a CAPTCHA provider
     needs a third-party account or (site key + secret key) neither of which
     I can self-provision, so it's left as a clean follow-up rather than
     blocking this step on setting one up.
  - **New table**: `PendingQuoteAttachment` — same "upload before the parent
    record exists" shape as the pre-existing `PendingOrderAttachment`
    (staff-dashboard-only, keyed by an authenticated session id), but keyed
    by a client-generated `quoteToken` instead, since an anonymous visitor
    has no session to key by.
  - **New upload route** (`app/api/site/special-goods-quote/upload/route.ts`,
    TDD'd, 10 tests) layers, in order: a pre-body Content-Length check
    (reused from the Archive package's own upload gate), a per-IP rate limit
    (reusing the existing DB-backed login/password-reset limiter,
    `lib/auth/rateLimit.ts` — the only per-IP limiter anywhere in this app;
    every other public route only has a weak process-global counter), a
    per-token photo cap (6), a post-buffer size re-check, and **real
    magic-byte file-content validation** (`sniffImageMimeType`, TDD'd) — the
    stored content type is always the sniffed value, never the client's
    claimed (freely spoofable) `Content-Type` header, which is what every
    other upload path in this app trusts blindly.
  - **Submission route** (`app/api/site/special-goods-quote/route.ts`,
    TDD'd, 9 tests): same unpriced-`Order`/quote-based shape as Moving, plus
    a honeypot field (reusing the exact pattern already in
    `app/api/public/vehicle-booking/route.ts`) and linking any uploaded
    photos into real `OrderAttachment` rows via
    `linkPendingQuoteAttachments` (mirrors the existing
    `linkPendingAttachmentsForSessionId`).
  - **UI** (`SpecialGoodsQuoteFlow.tsx`): a 5th homepage tile
    ("Spesialvarer"). Mined the dead `ServiceModal.tsx`'s dimension-picker
    UI a second time (first use was flagged as a candidate back in step 1),
    now actually used for the item-dimensions section. Photos upload
    immediately per-file (not batched at submit time), each removable
    before final submission.
  - **Wired in safely**: `ServiceWindow.tsx`'s existing 4-tile routing uses
    fragile positional-index math (`items[idx < 3 ? 0 : 1]`, flagged as tech
    debt back in step 3). Rather than extend that scheme to a 5th tile (real
    risk of subtly breaking one of the first 4), added the 5th tile as an
    explicit, separate special case keyed by its own index — verified by
    inspection that none of tiles 0-3's routing changed.
  - Verified: 28 new tests (upload route 10, submission route 9, the pure
    `pendingQuoteAttachments.ts` module 9), full `typecheck`/`lint`/`test`
    clean, 1117 passing (same pre-existing unrelated failures, no new ones).
    Docs added for every new file.
  - **Deliberately not done**: (1) CAPTCHA (see decision 2 above); (2) virus/
    malware scanning of uploaded files — content-type sniffing confirms a
    file is a real image, not that it's safe (out of scope for this pass,
    worth flagging if this becomes a real product before launch); (3) no
    automatic cleanup of orphaned `PendingQuoteAttachment` rows/S3 objects
    for a visitor who uploads photos then abandons the form entirely — these
    accumulate until a manual cleanup job exists (a cron similar to the
    existing GDPR/retention sweeps would be the natural home).

## 11. Suggested build order

Roughly in dependency order — each phase either unblocks or de-risks the next:

1. **Cleanup** (§3): decide the fate of `ServiceModal.tsx` and `Request`/`RequestItem`;
   fix `service-window.md`. Low effort, removes ambiguity for everything after.
2. **Privat/Bedrift toggle** (§2): the diagram calls this done for the live flow but
   it isn't — small, contained, and every pricing-display decision downstream (VAT
   primary/secondary) depends on it existing first.
3. **Moving, Option B (quote-based)** (§6): fastest path to a real, non-placeholder
   4th homepage tile; reuses 100% of the existing approve/pay/dispatch/email
   pipeline; needs the `pending_quote` status from §10.
4. **Post-payment "add items" flow** (§4): high value per the original ask, but
   sequence it after the pipeline is proven stable on more order types, since it
   touches the payment/event plumbing directly.
5. **Weight/dimension pricing primitive** (§5): once built, unlocks Pakke/pall, Andre
   varer, and an upgrade path from Moving-Option-B toward Option A/C.
6. **Services scoping decision, then build** (§7): needs a content decision from the
   business side before any code; likely small once decided.
7. **Accessories / extra services / insurance** (§9): mechanical additions once a
   pricing primitive exists for the categories that need them.
8. **Rental expansion** (§8): lowest urgency unless equipment rental is a near-term
   business priority.

---

## Appendix: source references

- Booking tree diagram (image): `Otman\Website\Delivery page\WhatsApp Image 2026-09-18 at 18.29.38.jpeg`
- Furniture product/pricing data: `Otman\Website\Delivery page\Otman_furniture_product_options_2026_FINAL(2).xlsx`
  (sheets: Product options, Produktvalg (NO), Order-level extras, Pricing basis &
  sources, Manufacturer matrix, Rules & notes) — already seeded into
  `lib/content/furnitureCatalogData.ts`.
- White goods product/pricing data: `Otman\Website\Delivery page\Otman_white_goods_product_options_2026_FINAL(1).xlsx`
  — already seeded (see `lib/content/websiteCatalogs.ts` and related).
- `Otman\Website\Delivery page\Otman_booking_upper_level_tree_v1_1.xlsx` — source
  workbook for the diagram; its "Rules & pricing" sheet is empty of extracted text
  (content is likely in embedded shapes/SmartArt, not cells) — the JPEG export is the
  usable artifact.
- `docs/documentation/excalidraw/Website order path.excalidraw` — matches the
  built approve → email → Stripe → request-change/cancel flow closely; not a case of
  code lagging spec, the spec itself only ever called for free-text request-change.
