# V1 — Auth + Identity Module (Next.js)

## Goal
Build a reusable, SaaS-grade Auth + Identity module focused on backend quality,
multi-tenancy, and security. Frontend is minimal and utilitarian.

This module must be:
- Reusable across projects
- Safe by default
- Easy to integrate into a new Next.js app
- Suitable for licensing later

---

## Locked Decisions (V1)

- Framework: **Next.js (App Router)**
- Architecture: **Multi-tenant**
- Identity model:
  - `User` = authentication (email + password)
  - `Membership` = authorization (user ↔ company ↔ role)
- Email uniqueness: **Globally unique**
- Session model: **DB-backed sessions**
- Session security:
  - Hashed session tokens
  - Hashed IP / user-agent
  - httpOnly, secure cookies
  - Revocable + rotatable
- Tenant resolution:
  - Post-login tenant selection when user belongs to multiple companies
- Signup model:
  - Hybrid: first user creates company + OWNER
  - Existing users may later belong to multiple companies through memberships
  - Additional company creation for an already authenticated user is a **separate future flow**
  - All non-owner access expansion is invite-based

---

## Core Entities (Conceptual)

- User
- Company (Tenant)
- Membership (User ↔ Company, role, status)
- Session
- PasswordResetToken
- AuthEvent (audit + security events)
- RateLimitBucket

---

## Roles (V1)

- OWNER
- ADMIN
- USER

(No permission engine in V1)

---

## V1 Scope Checklist

### Identity & Auth
- [x] User signup (first user creates company)
- [x] Email + password login
- [x] Password hashing (Argon2id)
- [x] Login rate limiting
- [x] Logout
- [x] Password reset flow
- [x] Password reset delivery abstraction (adapter + dev fallback)
- [ ] Disable user

### Sessions
- [x] Create session on login
- [x] Create session on signup
- [x] Store hashed session tokens
- [x] Store hashed IP + user-agent on session creation
- [x] Session expiration
- [x] Session revocation (current session logout)
- [x] Logout all sessions
- [x] List active sessions
- [x] Revoke other sessions
- [x] Invalidate sessions on password/role change
- [x] Persist active tenant on session

### Multi-tenancy
- [x] Company creation during first-user signup
- [x] Membership creation during first-user signup
- [x] Role assignment during first-user signup (OWNER)
- [x] Multi-membership model in `/api/auth/me`
- [ ] Tenant selection challenge for multi-company users
- [x] Active tenant selection / persistence
- [ ] Authenticated “create another company” flow

### Security & Audit
- [x] AuthEvent logging for login success/failure
- [x] AuthEvent logging for logout
- [x] IP + user-agent hashing
- [ ] Signup success audit event
- [x] RateLimitBucket enforcement

### API Surface (implemented)
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/signup`
- [x] `POST /api/auth/logout`
- [x] `POST /api/auth/logout-all`
- [x] `GET /api/auth/me`
- [x] `POST /api/auth/tenant/select`
- [x] `GET /api/auth/sessions`
- [x] `POST /api/auth/sessions/revoke`
- [x] `POST /api/auth/memberships/disable`
- [x] `POST /api/auth/memberships/[membershipId]/disable`
- [x] `POST /api/auth/memberships/[membershipId]/enable`
- [x] `POST /api/auth/memberships/[membershipId]/role`
- [x] `POST /api/auth/invites/create`
- [x] `POST /api/auth/invites/[inviteId]/revoke`
- [x] `POST /api/auth/invites/accept`
- [x] `POST /api/auth/password-reset/request`
- [x] `POST /api/auth/password-reset/complete`

### Admin / Invite
- [x] Invite user to company
- [x] Revoke invite
- [x] Accept invite flow
- [x] Self-disable membership
- [x] Disable membership (admin / cross-user)
- [x] Activate/deactivate membership (admin / cross-user)
- [x] Assign role

### Testing
- [x] Test runner setup (Vitest)
- [x] Typecheck script (tsc --noEmit)
- [x] Unit tests: password hashing
- [x] Unit tests: session token utilities
- [x] Unit tests: login flow
- [x] Unit tests: password reset flows
- [x] Password reset route tests
- [x] Login route tests
- [x] Signup route tests
- [x] Session validation tests
- [x] Logout route tests
- [x] `/api/auth/me` tests
- [x] Invite accept helper tests
- [x] Invite accept route tests

---

## Explicit Non-Goals (V1)

- OAuth / social login
- SSO / SAML
- Fine-grained permissions
- Magic links
- UI polish

---

## Quality Bar

- Every authenticated request must be identity-safe
- Tenant context must be explicit before tenant-scoped business actions
- No plaintext secrets stored
- No auth logic in frontend
- All security-sensitive paths auditable
- Testable without UI
