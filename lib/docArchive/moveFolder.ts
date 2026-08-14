import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { reassignFolderCode } from "@/lib/docArchive/folderCodes";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

// Same package gap as moveItem.ts (see that file's and
// custom-archive-backend-feedback.md #3's comments — no moveFolder/moveItem
// anywhere in the 47-method surface), same raw-write workaround. The one
// thing folders need that items didn't: a folder can be moved into one of
// its OWN descendants, which items can never do (items have no children) —
// that would disconnect the whole subtree from the root (or worse, from
// itself) and break every ancestor-chain walk (permissions, folder path,
// stats) that assumes the tree is acyclic. Checked explicitly below.
//
// Moving to the archive root was supported in an earlier pass and then
// deliberately removed, on explicit user request, after it caused a real
// bug: a non-root folder is never directly granted `view`/`manage_permissions`
// of its own (only inherited from its ancestor chain), so moving one to
// root — no ancestor left to inherit from — silently made it invisible,
// even to whoever moved it (denials never leak in this package, so it just
// vanished with no error). The fix at the time was to replicate
// createFolder's own auto-grant when the destination was root, but that
// still only restored access for the mover, not anyone else who could
// previously see it only via inheritance — a real gap. Rather than solve
// that properly, the user asked to just disallow moving to root outright,
// so destinationFolderId is a plain required string now, not nullable.
type ArchiveRawClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};
const db = archivePrisma as unknown as ArchiveRawClient;

export type MoveFolderResult =
  | { ok: true }
  | { ok: false; reason: "FOLDER_NOT_FOUND" | "DESTINATION_NOT_FOUND" | "SAME_FOLDER" | "CYCLE" | "INVALID_SECTION" };

// destinationSectionId is required (not defaulted to "ungrouped") — same
// reasoning as moveItemToFolder: the mover always picks a real section
// inside the destination folder, validated via sectionBelongsToScope before
// anything is written.
export async function moveFolderToFolder(
  ctx: ArchiveContextInput,
  folderId: string,
  destinationFolderId: string,
  destinationSectionId: string,
): Promise<MoveFolderResult> {
  const folderResult = await archive.readFolder(ctx, folderId);
  if (!folderResult.ok) return { ok: false, reason: "FOLDER_NOT_FOUND" };

  const currentParentId = folderResult.value.parentFolderId ?? null;
  if (currentParentId === destinationFolderId) return { ok: false, reason: "SAME_FOLDER" };
  if (destinationFolderId === folderId) return { ok: false, reason: "CYCLE" };

  const destinationResult = await archive.readFolder(ctx, destinationFolderId);
  if (!destinationResult.ok) return { ok: false, reason: "DESTINATION_NOT_FOUND" };

  const wouldCycle = await isFolderOrDescendant(ctx.companyId, ctx.tenantId, folderId, destinationFolderId);
  if (wouldCycle) return { ok: false, reason: "CYCLE" };

  const validSection = await sectionBelongsToScope(ctx.companyId, ctx.tenantId, destinationFolderId, destinationSectionId);
  if (!validSection) return { ok: false, reason: "INVALID_SECTION" };

  const updatedRows = await db.$executeRawUnsafe(
    `UPDATE archive."archive_folders"
     SET "parentFolderId" = $1, "updatedAt" = now()
     WHERE "id" = $2 AND "companyId" = $3 AND "tenantId" = $4 AND "deletedAt" IS NULL`,
    destinationFolderId,
    folderId,
    ctx.companyId,
    ctx.tenantId,
  );
  if (updatedRows === 0) return { ok: false, reason: "FOLDER_NOT_FOUND" };

  await reassignFolderCode(ctx.companyId, ctx.tenantId, folderId, destinationFolderId, destinationSectionId);

  return { ok: true };
}

// True if `candidateId` is `rootId` itself or anywhere in its descendant
// subtree — same recursive-descendants shape as folderStats.ts's
// getFolderEntryCounts, just checking membership instead of counting.
async function isFolderOrDescendant(
  companyId: string,
  tenantId: string,
  rootId: string,
  candidateId: string,
): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `
    WITH RECURSIVE subtree AS (
      SELECT "id"
      FROM archive."archive_folders"
      WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL AND "id" = $3
      UNION ALL
      SELECT f."id"
      FROM archive."archive_folders" f
      JOIN subtree s ON f."parentFolderId" = s."id"
      WHERE f."companyId" = $1 AND f."tenantId" = $2 AND f."deletedAt" IS NULL
    )
    SELECT "id" FROM subtree WHERE "id" = $4
    `,
    companyId,
    tenantId,
    rootId,
    candidateId,
  );
  return rows.length > 0;
}
