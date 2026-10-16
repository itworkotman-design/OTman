# `lib/content/serviceRequestCatalog.ts`

## Purpose
The services offered by the homepage "Services" modal, derived from
`TjenesterContent.jobTypeOptions` (the /tjenester page's "Type of job" list)
so both stay in sync, each with an icon key. Shared by the flow (client) and
`/api/site/service-request` (server).

## Functions
- `SERVICE_REQUEST_OPTIONS` — `{ code, iconKey, labelEn, labelNo }[]`; a new
  jobTypeOption without an icon mapping falls back to the custom icon.
- `isServiceChoiceReady(code, customService)` — a known service is picked (and
  for `custom`, described).
- `serviceRequestLabel(code, customService, locale)` — display name
  (`"Custom service — Painter"` for custom), or null.
- `parseServiceChoice(rawCode, rawCustom)` — server-side validation; returns
  the English label staff see, or `{ serviceCode | customService }` errors.
