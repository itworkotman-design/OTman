# `lib/orders/insuranceCases.ts`

## Purpose
Resolves which store (membership) the Insurance cases dashboard page is locked to. Configured per environment with `INSURANCE_CASES_USER_EMAIL`.

## Functions
### `getInsuranceCasesUserEmail()`
Returns the trimmed, lowercased `INSURANCE_CASES_USER_EMAIL`, or `null` when unset/blank.

### `getInsuranceCasesStore(companyId)`
Looks up the ACTIVE membership in `companyId` whose user email matches (case-insensitive). Returns `{ ok: true, membershipId, label }` (label = username, falling back to email), `{ ok: false, reason: "NOT_CONFIGURED" }`, or `{ ok: false, reason: "USER_NOT_FOUND", email }`.
