# Custom Archive backend — feedback log

Running log of bugs, inconsistencies, or undocumented behavior found in the
`@customprojects/custom-archive` package (`git+https://github.com/CustomProjectsAS/custom-archive.git#delivery/source-foundation`)
while integrating it into OTman. Meant to be passed along to the team
maintaining that repo. Not a description of OTman's own code — see
`lib/docArchive/*` and `app/api/archive/*` for how OTman consumes the package.

Only things that trace back to the package itself — not host-side bugs in our
own `lib/docArchive`/`app/api/archive` code.

---

## 1. `createFolder` doesn't grant the creator enough to actually use the folder

After `createFolder` succeeds, the creator is automatically granted only
`view` and `manage_permissions` on the new folder (confirmed via
`getEffectiveCapabilities` against a real folder). They are **not** granted
`create`, `upload`, `edit`, `delete`, `restore`, `move`, `manage_metadata`, or
`manage_status`. Since a brand-new folder has zero permission rules on any of
those actions, the person who just created it cannot add an item to it,
upload a file to it, rename it, or delete it — every one of those calls comes
back `not_found` (the non-leaking category used for permission denials),
which looks identical to "this folder doesn't exist."

This isn't documented anywhere in `docs/API.md` or `docs/INTEGRATION.md` —
both describe `createFolder`'s *capability requirement* (`create @ namespace`
for a root folder) but say nothing about what the caller receives on the
folder afterward. A host implementing against the docs alone would
reasonably assume the creator ends up with full control of what they just
made (that's the near-universal convention in systems like this), hit a wall
immediately, and have no way to tell from the error message alone that this
is expected behavior rather than a bug.

---

## 2. No way to rename/edit a folder or item's name or description

`createFolder`/`createItem` are the only place `name`/`description` can ever
be set — there is no `updateFolder`/`updateItem`/`renameFolder` method
anywhere in the 47-method surface. The only post-creation mutations are
`setFolderStatus`/`setItemStatus` (business status: active/inactive/draft/
archived) and `setFolderDates`/`setItemDates` (due/expiry dates). A typo in a
folder or item name can never be fixed short of deleting and recreating it
(which loses its id, history, and any items/files already attached).

This also looks like a loose end rather than a deliberate omission: `edit` is
one of the 10 `ARCHIVE_PERMISSION_ACTIONS` the permission model defines
(alongside `view`, `create`, `upload`, `delete`, `restore`, `move`,
`manage_metadata`, `manage_status`, `manage_permissions`), but none of the 47
host-adapter methods ever check for `edit` — it's a capability a host can
grant via `setPermissionRule`, but nothing in the package currently exercises
it.
