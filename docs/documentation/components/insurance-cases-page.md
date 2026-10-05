# `app/(User)/dashboard/booking/insurance-cases/page.tsx`

## Purpose
Admin-only Insurance cases page: the main order list locked to the one store (user) that handles all insurance cases.

## Functions
### `InsuranceCasesPage()`
Server component. Resolves the session + active membership (the parent booking layout already requires the `BOOKING` module), redirects non-OWNER/ADMIN members to `/dashboard/booking`, resolves the insurance store via `getInsuranceCasesStore()` (`INSURANCE_CASES_USER_EMAIL`), and renders `BookingOrdersView` with the `insuranceCases` variant. If the env var is unset or no active membership matches it in the active company, renders a configuration message instead of the list.
