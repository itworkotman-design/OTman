# Archive UI — known gaps

Two features visible in the Archive UI are **intentionally unimplemented
placeholders**, not bugs. Both are host-side (OTman) scope decisions, not
`@customprojects/custom-archive` package issues, so they're recorded here
rather than in `custom-archive-backend-feedback.md`.

---

## Pinned folders

The "Pinned folders" section on the archive root page
(`app/(User)/dashboard/archive/page.tsx`, rendered via
`PinnedFoldersSection`) is visible but disabled/static — a "Coming soon"
placeholder. The per-row pin toggle that used to sit on every `FolderPill`
row was removed (2026-07-29, on request) since it had no function and was
just visual clutter; the section above remains the only surviving pin-related
UI.

There is no `pinned` field anywhere on `ArchiveFolder` — the package has no
concept of pinning at all. Implementing this for real would mean either a
client-side-only preference (e.g. `localStorage`, not shared across devices
or teammates) or a genuine new backend field, neither of which was in scope
for this pass.

## Structured/spreadsheet ("excel") items

The disabled "Add spreadsheet (coming soon)" control next to each item's
upload button (`ExcelPlaceholder`,
`app/_components/Dahsboard/archive/ExcelPlaceholder.tsx`) never calls any API.

Items have no type discriminator (`itemType` is always `"record"`, see
`docs/API.md` in the package) and there is no tabular/structured-data storage
anywhere in the package — items only ever hold generic uploaded files. Adding
real structured data support would require a package-level change (a new
storage shape and API surface), not something the host app can add on its
own.
