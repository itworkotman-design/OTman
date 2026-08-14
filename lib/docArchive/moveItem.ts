import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { reassignItemCode } from "@/lib/docArchive/folderCodes";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

// The @customprojects/custom-archive package has no moveItem (or moveFolder)
// method anywhere in its 47-method surface — `move` is defined as one of the
// 10 ARCHIVE_PERMISSION_ACTIONS (docs/API.md) but, like `edit` (see
// custom-archive-backend-feedback.md #2), nothing in the package ever checks
// for it or exposes a way to actually change an item's folderId. Logged as
// feedback entry #3 for the college team; this is the host-side workaround
// in the meantime, on explicit user request to build it now rather than wait.
//
// `archivePrisma` is typed as the package's narrow internal
// PrismaArchiveHostAdapterClient contract, not a general query client, but
// at runtime it's a real generated PrismaClient — same local-type-cast
// workaround as folderStats.ts/runArchiveRetentionSweep.ts, just the first
// use of it for a WRITE rather than a read. This bypasses the package's own
// write path entirely (there is no other way in, since no method exists),
// so it's done as narrowly as possible: one UPDATE, scoped by id + company +
// tenant + not-already-deleted, nothing else touched. Verified via schema
// inspection (`\d archive.archive_items`) that folderId has no triggers, no
// denormalized/cached copies elsewhere, and every reader (permission
// resolution, display codes, folder path/ancestry, stats) recomputes live
// from this column on each request — so a direct update is immediately and
// fully consistent everywhere, nothing else needs to be told about it.
type ArchiveWriteClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};
const db = archivePrisma as unknown as ArchiveWriteClient;

export type MoveItemResult =
  | { ok: true }
  | { ok: false; reason: "ITEM_NOT_FOUND" | "DESTINATION_NOT_FOUND" | "SAME_FOLDER" | "INVALID_SECTION" };

// Authorization note: the package can't enforce a `move` capability check
// itself (no such method exists to call), so this relies on two things
// instead — the route requiring company ADMIN (requireArchiveMembership's
// requireAdmin), and `readItem`/`readFolder` below still going through the
// package for real, which means a caller who can't even view the item or the
// destination folder gets NOT_FOUND here exactly like every other route in
// this integration (denials never leak, per the established "not_found"
// convention used throughout this codebase's archive routes).
//
// destinationSectionId is required (not defaulted to "ungrouped") — the
// caller (MoveEntityModal) always has the mover pick a real section inside
// the destination folder first, same as creating an item there directly
// would require, and validated here the same way createItem's route does
// (sectionBelongsToScope) before anything is written.
export async function moveItemToFolder(
  ctx: ArchiveContextInput,
  itemId: string,
  destinationFolderId: string,
  destinationSectionId: string,
): Promise<MoveItemResult> {
  const itemResult = await archive.readItem(ctx, itemId);
  if (!itemResult.ok) return { ok: false, reason: "ITEM_NOT_FOUND" };
  if (itemResult.value.folderId === destinationFolderId) return { ok: false, reason: "SAME_FOLDER" };

  const folderResult = await archive.readFolder(ctx, destinationFolderId);
  if (!folderResult.ok) return { ok: false, reason: "DESTINATION_NOT_FOUND" };

  const validSection = await sectionBelongsToScope(ctx.companyId, ctx.tenantId, destinationFolderId, destinationSectionId);
  if (!validSection) return { ok: false, reason: "INVALID_SECTION" };

  const updatedRows = await db.$executeRawUnsafe(
    `UPDATE archive."archive_items"
     SET "folderId" = $1, "updatedAt" = now()
     WHERE "id" = $2 AND "companyId" = $3 AND "tenantId" = $4 AND "deletedAt" IS NULL`,
    destinationFolderId,
    itemId,
    ctx.companyId,
    ctx.tenantId,
  );
  if (updatedRows === 0) return { ok: false, reason: "ITEM_NOT_FOUND" };

  await reassignItemCode(ctx.companyId, ctx.tenantId, itemId, destinationFolderId, destinationSectionId);

  return { ok: true };
}
