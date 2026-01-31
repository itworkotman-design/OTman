# OTman — Delivery Plan (Authoritative)

Only tick items when there is concrete proof (code merged + build green, or verified behavior).

---

## Phase P0 — Foundation (done)
- [x] Prisma schema matches the domain (Category, Service, PricingMode).
- [x] Migrations exist and are applied.
- [x] Public catalog read is server-side (no client Prisma).
- [x] `getPublicCatalog()` exists and reads only active categories/services.
- [x] Public catalog sorting is deterministic (category + service ordering).
- [x] `npm run build` passes.

---

## Phase P1 — Public catalog UX (now)
Goal: a customer can browse safely even when DB is slow or broken.

- [x] Loading state for catalog (Suspense + skeleton).
- [x] Error state for `/` (error boundary UI, no stack trace leakage).
- [x] Empty state copy is customer-friendly (not developer-speak).
- [ ] Contact CTA has real business details (email/phone placeholders removed).

---

## Phase P2 — Public request flow (optional, but likely)
Goal: customer can submit a request without accounts.

- [ ] Define minimal Request data shape (name/contact/message + optional service reference).
- [ ] Add submit endpoint (server-only) with validation.
- [ ] Store request in DB (Prisma model + migration).
- [ ] Basic anti-abuse controls (rate limit + honeypot field).
- [ ] Success + error UX for submit.

---

## Phase A0 — Admin foundation (later)
Goal: private admin exists, protected.

- [ ] Pick auth approach (simple owner login is enough).
- [ ] Session cookie (httpOnly) + logout.
- [ ] `/admin` gate exists (cannot access without auth).
- [ ] Rate-limit login attempts.

---

## Phase A1 — Admin CRUD (later)
Goal: owner can manage catalog without DB edits.

- [ ] Categories CRUD (create/update/deactivate/reactivate).
- [ ] Services CRUD (create/update/deactivate/reactivate).
- [ ] Validation rules enforced (FIXED vs REQUEST pricing, lengths, required fields).
- [ ] No hard deletes (deactivate only).

---

## Phase PR — Production readiness (when real)
- [ ] `.env.example` added (no secrets).
- [ ] Local DB workflow documented (migrate/seed).
- [ ] Error handling strategy (no leaking internals).
- [ ] DB backup plan.
- [ ] Privacy policy + data retention notes.
