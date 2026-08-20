import type { ArchiveContextInput } from "@customprojects/custom-archive";
import type { ArchiveReminderEntityKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { archive } from "@/lib/docArchive/client";
import { withFolderStats, type ArchiveFolderWithStats } from "@/lib/docArchive/withFolderStats";
import { withItemStats, type ArchiveItemWithStats } from "@/lib/docArchive/withItemStats";

// Records/reads per-user "last opened" timestamps for folders/items reached
// through the "Shared with me" entry point (lib/docArchive/sharedWithMe.ts) —
// backs the archive root page's inline "Shared with you" preview. See
// ArchiveSharedRecentOpen in schema.prisma.
export async function recordSharedOpen(
  companyId: string,
  tenantId: string,
  userId: string,
  entityKind: ArchiveReminderEntityKind,
  entityId: string,
): Promise<void> {
  await prisma.archiveSharedRecentOpen.upsert({
    where: { userId_entityKind_entityId: { userId, entityKind, entityId } },
    create: { companyId, tenantId, userId, entityKind, entityId },
    update: { openedAt: new Date() },
  });
}

export type RecentSharedOpens = {
  folders: ArchiveFolderWithStats[];
  items: ArchiveItemWithStats[];
};

// Re-checks each candidate through the package's own authoritative
// readFolder/readItem before returning it — same defensive pattern as
// listDirectlyGrantedTargets' callers (see app/api/archive/shared-with-me/
// route.ts) — so a since-revoked share silently drops out of the preview
// instead of erroring or leaking. No fallback-fill when there are fewer than
// `limit` rows: an empty result here legitimately means "nothing opened yet",
// distinct from "nothing shared" (the expand action still shows the latter).
export async function listRecentSharedOpens(ctx: ArchiveContextInput, limit: number): Promise<RecentSharedOpens> {
  const rows = await prisma.archiveSharedRecentOpen.findMany({
    where: { companyId: ctx.companyId, tenantId: ctx.tenantId, userId: ctx.userId },
    orderBy: { openedAt: "desc" },
    take: limit,
  });

  if (rows.length === 0) return { folders: [], items: [] };

  const folderRows = rows.filter((row) => row.entityKind === "FOLDER");
  const itemRows = rows.filter((row) => row.entityKind === "ITEM");

  const [folderResults, itemResults] = await Promise.all([
    Promise.all(folderRows.map((row) => archive.readFolder(ctx, row.entityId))),
    Promise.all(itemRows.map((row) => archive.readItem(ctx, row.entityId))),
  ]);

  const folders = folderResults.filter((r) => r.ok).map((r) => r.value);
  const items = itemResults.filter((r) => r.ok).map((r) => r.value);

  const [foldersWithStats, itemsWithStats] = await Promise.all([
    withFolderStats(ctx, folders),
    withItemStats(ctx, items),
  ]);

  return { folders: foldersWithStats, items: itemsWithStats };
}
