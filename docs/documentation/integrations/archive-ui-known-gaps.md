# Archive UI — known gaps

One feature visible in the Archive UI is an **intentionally unimplemented
placeholder**, not a bug. It's a host-side (OTman) scope decision, not a
`@customprojects/custom-archive` package issue, so it's recorded here rather
than in `custom-archive-backend-feedback.md`.

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

## Structured/spreadsheet ("excel") items — resolved

Items still have no type discriminator (`itemType` is always `"record"`, see
`docs/API.md` in the package) and there is no tabular/structured-data storage
anywhere in the package — items only ever hold generic uploaded files. That
part is still true and still package-level.

It stopped being a UI gap, though: a `SPREADSHEET` content section type now
exists, storing its grid entirely host-side in `ArchiveItemSpreadsheet`
(`prisma/schema.prisma`, see `lib/docArchive/spreadsheets.ts`) — the exact
same pattern `ArchiveItemTextField` already used for Text-fields sections.
Editing is `app/_components/Dahsboard/archive/SpreadsheetPanel.tsx` (built on
the `react-spreadsheet` library), with Excel import/export done client-side
via `exceljs` in `lib/docArchive/spreadsheetExcel.ts`.

## Content section deferred-save (2026-08-10)

The item settings page's Content section (`ContentSectionList.tsx`) no longer
writes anything to the database or S3 as it happens — adding/deleting a whole
section, uploading/deleting a file or image, reordering, and text-field/
spreadsheet edits are all staged locally and only committed when the single
Save button at the bottom of the section is clicked. Uploads specifically
stay purely client-side (a `File` object + an object-URL preview for images)
until Save's upload phase actually sends the bytes — see the `StagedUpload`
type and `runUploadPhase` in `ContentSectionList.tsx`.

Save deliberately runs uploads (if any) BEFORE the rest of the metadata
commit, not after — the reverse of the obvious ordering — specifically so
cancelling mid-upload can undo the whole save, not just the files. The only
metadata that has to happen before uploads is creating a real section for
anything a pending upload targets (uploads need a real section id to attach
to); every other pending change — remaining new sections, deletes, reorder,
text-field/spreadsheet flushes — is deliberately held back until the upload
phase (`ContentSaveUploadModal`, driven by `runUploadPhase`) confirms nothing
was cancelled. `ContentSaveUploadModal` uploads files one at a time with a
per-file progress bar and never auto-closes (it waits for an explicit Close
after reaching "Item saved", per an explicit user request that closing
prematurely shouldn't silently happen). Closing it before it finishes is
allowed but warns first, then: hard-deletes every file that did finish
uploading during that batch, deletes the section(s) that were only created to
host those uploads, and skips the rest of the metadata commit entirely —
`pendingUploads` and everything else staged locally is left untouched so
Save can just be pressed again, matching "as if Save was never pressed" per
explicit user request (an earlier version of this only rolled back the files
and left already-created sections committed — the user found that
surprising in practice and asked for the stronger guarantee).

That immediate hard-delete needed a new host-side exception:
`archive.purgeFile` (the package's only permanent-delete method) refuses to
act on a file unless it's already soft-deleted **and** past the configured
retention window (`docs/API.md`), so it can't hard-delete a file that's still
active. `lib/docArchive/discardUnsavedFile.ts` bypasses the package's public
surface for this one case — a narrow raw-Prisma read + delete against
`archivePrisma` (same "real full Prisma client under a deliberately narrow
type" pattern already used by `folderStats.ts`/`runArchiveRetentionSweep.ts`,
just a write this time) plus a direct `archiveS3StorageProvider.delete` call
— guarded to only ever run on a file that's still active (never
soft-deleted), so it can never reach a file that went through the normal
delete lifecycle. Exposed via
`DELETE /api/archive/items/[itemId]/files/[fileId]/discard`.
