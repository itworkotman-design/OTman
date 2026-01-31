# OTman — Service Catalog Web App (Concept + Architecture)

## What this is
A small-business service catalog website with a private admin surface.

It is not a demo. It is meant to be deployed, updated, and used by a real business with real pricing rules.

## The core promise (customer)
Customers can:
- browse services grouped by category
- understand pricing immediately (fixed price vs “Price on request”)
- request contact with minimal friction

## The core promise (owner/admin)
Owner can:
- manage categories and services without touching the database
- deactivate items instead of deleting history
- keep the public site simple, stable, and fast

## Surfaces
### Public (customer)
- Read-only catalog
- Clear pricing rules
- Clear contact CTA (no account, no payment)

### Private (admin)
- Auth required
- CRUD for categories + services
- Basic request inbox later (optional)

## Data truth
- One database (Postgres)
- Prisma schema is the source of truth
- Public UI must never depend on “seed demo data” in production

## Current state
- Next.js App Router + TypeScript + Tailwind
- Prisma + Postgres
- Customer page reads services and groups by category
- Manual DB control is allowed for early stage

## Non-goals (for now)
- Online payments
- Public service detail pages
- Customer accounts
- Automated request processing
- “Enterprise” features (multi-org, roles, audit trails)

These only come after the customer catalog is solid.

---

# Architecture

## Modules (high-level)
### UI layer
- `app/` routes and server components
- Customer page at `/` (public)

### Data access
- `lib/db.ts` exports Prisma client
- DB reads should be server-side by default
- Keep data access predictable: no magic client-side fetching unless necessary

### Database
- Postgres
- Prisma migrations committed in repo
- Environment provides the DB connection string via `.env` (never committed)

---

# Key domain concepts

## Category
A grouping label for services (e.g., Delivery, Moving, Transport).

Rules:
- Category name must be unique (or unique by slug).
- Categories can be hidden/deactivated (no hard deletes once admin exists).

## Service
A sellable offering shown on the customer site.

Fields (conceptual):
- name
- description (short)
- categoryId
- pricing mode:
  - FIXED: amountNok
  - REQUEST: show “Price on request”
- visibility:
  - ACTIVE: visible to customers
  - INACTIVE: hidden from customers but kept in DB

Rules:
- Public site shows ACTIVE only.
- Pricing display must be consistent and impossible to misunderstand.

## Request (later)
A customer inquiry that references one or more services (optional).

Rules:
- Not required to launch v1.
- If added, store minimal info: contact + message + createdAt.

---

# Stability rules (engineering)
- Public catalog must work even if admin does not exist.
- No breaking schema changes without migration.
- No secrets in git (ever).
- Every change must keep the app buildable and deployable.

---

# “Done” criteria for v1
Public catalog:
- looks professional on mobile
- handles empty/loading/error states
- pricing rules are consistent and clear
- contact CTA is obvious and works
