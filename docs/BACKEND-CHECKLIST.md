# OTman — Backend Checklist (Execution)

> This is a backend-focused checklist. Only tick items when proven done.

## 0) Baseline hygiene
- [ ] Confirm Prisma schema matches the intended domain (Category, Service, pricing, active flag).
- [ ] Add `.env.example` with required vars (no secrets).
- [ ] Document local DB workflow (create DB, migrate, seed/manual SQL).
- [ ] Ensure `npm run build` passes.

## 1) Data model hardening (Prisma)
- [ ] Category model:
  - [ ] unique name or unique slug
  - [ ] `isActive` (default true)
  - [ ] timestamps (`createdAt`, `updatedAt`)
- [ ] Service model:
  - [ ] belongs to Category
  - [ ] `isActive` (default true)
  - [ ] pricing mode enum: `FIXED` | `REQUEST`
  - [ ] amount (nullable; required only when FIXED)
  - [ ] timestamps (`createdAt`, `updatedAt`)
- [ ] Add DB-level constraints (where practical):
  - [ ] FIXED requires amount
  - [ ] REQUEST forbids amount (optional constraint, can be app-level first)
- [ ] Add indexes:
  - [ ] `Service.categoryId`
  - [ ] `Service.isActive`
  - [ ] `Category.isActive`

## 2) Server-side data access conventions
- [ ] Centralize prisma usage in `lib/db.ts` only.
- [ ] Create server-only query helpers:
  - [ ] `getPublicCatalog()` returns active categories + active services
  - [ ] sorted results (category name ASC, service name ASC)
- [ ] No client-side fetching for public catalog.

## 3) Public API (only if/when needed)
> If you keep everything server-rendered, skip APIs for now.
- [ ] Add route `/api/public/catalog` (GET) only if required later.
- [ ] Standardize response shape (ok/error).
- [ ] Hide internal errors from clients.

## 4) Admin auth foundation (later, but planned)
- [ ] Choose auth approach:
  - [ ] password-based owner login
  - [ ] session cookie (httpOnly)
- [ ] Create minimal admin gate:
  - [ ] `/admin` requires auth
  - [ ] logout
- [ ] Rate-limit login attempts.

## 5) Admin CRUD backend (after auth)
- [ ] Categories endpoints/actions:
  - [ ] create
  - [ ] update
  - [ ] deactivate/reactivate
- [ ] Services endpoints/actions:
  - [ ] create
  - [ ] update
  - [ ] deactivate/reactivate
- [ ] Validation rules:
  - [ ] FIXED requires amount > 0
  - [ ] REQUEST ignores amount
  - [ ] name length limits
  - [ ] safe description length limits

## 6) Requests (optional, phase later)
- [ ] Request model in Prisma
- [ ] Public “request service” action stores a request
- [ ] Admin inbox list + status workflow

## 7) Production readiness (when real)
- [ ] Logging strategy (minimal)
- [ ] Error boundaries (no leaking stack traces)
- [ ] DB backups plan
- [ ] Privacy policy + data retention notes
