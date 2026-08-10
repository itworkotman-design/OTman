import type {
  ArchiveContextInput,
  ArchiveHostAdapterResult,
  ArchiveRecoverableFile,
} from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archive, archivePrisma } from "@/lib/docArchive/client";

export type ArchiveRecoverableFileRow = ArchiveRecoverableFile & {
  deletedByName: string | null;
};

// `ArchiveRecoverableFile` (the archive package's own public projection) is
// built field-by-field and deliberately omits `deletedByUserId` — see that
// type's own comment in the package. It's a real column on the package's
// own `archive_files` table though (`ArchiveFileRecord.deletedByUserId`), so
// it's fetched here via the same narrow-cast-and-query-the-real-Prisma-client
// pattern runArchiveRetentionSweep.ts already uses for purge candidates
// (`archivePrisma` is typed narrow, but is a real full PrismaClient at
// runtime). Resolved against OTman's own User table since the archive
// package has no concept of a display name, only the raw cross-database
// userId.
type ArchiveFileActorQueryClient = {
  archiveFile: {
    findMany(args: {
      where: { id: { in: string[] }; companyId: string };
      select: { id: true; deletedByUserId: true };
    }): Promise<{ id: string; deletedByUserId: string | null }[]>;
  };
};

// Wraps the package's own `listRecoverableFilesForItem` (so its
// authorization check and deleted-unpurged filtering stay authoritative)
// and enriches each row with who deleted it, sorted most-recently-deleted
// first — the package's own default order is by upload time, not deletion
// time, since it doesn't specifically cater to a "show deleted files" view.
export async function listRecoverableFilesForItemWithActor(
  ctx: ArchiveContextInput,
  itemId: string,
): Promise<ArchiveHostAdapterResult<ArchiveRecoverableFileRow[]>> {
  const listResult = await archive.listRecoverableFilesForItem(ctx, itemId);
  if (!listResult.ok) return listResult;

  const files = listResult.value;
  if (files.length === 0) return { ok: true, value: [] };

  const actorRows = await (
    archivePrisma as unknown as ArchiveFileActorQueryClient
  ).archiveFile.findMany({
    where: { id: { in: files.map((f) => f.id) }, companyId: ctx.companyId },
    select: { id: true, deletedByUserId: true },
  });
  const deletedByUserIdByFileId = new Map(actorRows.map((row) => [row.id, row.deletedByUserId]));

  const actorUserIds = [
    ...new Set(actorRows.map((row) => row.deletedByUserId).filter((id): id is string => id !== null)),
  ];
  const users =
    actorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorUserIds } },
          select: { id: true, username: true, email: true },
        })
      : [];
  const nameByUserId = new Map(users.map((u) => [u.id, u.username || u.email]));

  const rows: ArchiveRecoverableFileRow[] = files
    .map((file) => {
      const deletedByUserId = deletedByUserIdByFileId.get(file.id) ?? null;
      return {
        ...file,
        deletedByName: deletedByUserId ? (nameByUserId.get(deletedByUserId) ?? null) : null,
      };
    })
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return { ok: true, value: rows };
}
