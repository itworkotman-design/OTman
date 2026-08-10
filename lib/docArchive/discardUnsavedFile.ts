import { archivePrisma } from "@/lib/docArchive/client";
import { archiveS3StorageProvider } from "@/lib/docArchive/storageProvider";
import { prisma } from "@/lib/db";

// `archive.purgeFile` — the package's only permanent-delete method — refuses
// to act on a file unless it's already soft-deleted AND past the configured
// retention window (docs/API.md: "a still-active file ... is a
// `validation`-category rejection"). That's the right guard for the normal
// delete lifecycle, but it makes it impossible to immediately hard-delete a
// file that was just uploaded moments ago as part of an item-settings Save
// that the user then cancelled before confirming (see ContentSectionList's
// upload-progress modal) — there is no supported package method for that.
//
// This bypasses the package's public surface entirely for that one narrow
// case, the same category of exception already used by
// folderStats.ts/runArchiveRetentionSweep.ts for raw reads against
// `archivePrisma` (a deliberately narrow-typed but, at runtime, real full
// Prisma client) — this is the write-side equivalent, scoped to exactly one
// query + one delete.
type ArchiveFileDiscardQueryClient = {
  archiveFile: {
    findFirst(args: {
      where: { id: string; companyId: string; tenantId: string };
      select: { archiveItemId: true; storageProvider: true; storageKey: true; deletedAt: true };
    }): Promise<{ archiveItemId: string; storageProvider: string; storageKey: string; deletedAt: Date | null } | null>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
};

export type DiscardUnsavedFileResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "ITEM_MISMATCH" | "ALREADY_DELETED" };

// Only ever safe to call on a file that is still active (never soft-deleted)
// — a file that's already gone through the normal delete flow is real,
// previously-saved content, not a same-session upload artifact, and must
// never be hard-deleted by this path.
export async function discardUnsavedFile(
  companyId: string,
  tenantId: string,
  itemId: string,
  fileId: string,
): Promise<DiscardUnsavedFileResult> {
  const file = await (archivePrisma as unknown as ArchiveFileDiscardQueryClient).archiveFile.findFirst({
    where: { id: fileId, companyId, tenantId },
    select: { archiveItemId: true, storageProvider: true, storageKey: true, deletedAt: true },
  });

  if (!file) return { ok: false, reason: "NOT_FOUND" };
  if (file.archiveItemId !== itemId) return { ok: false, reason: "ITEM_MISMATCH" };
  if (file.deletedAt !== null) return { ok: false, reason: "ALREADY_DELETED" };

  if (file.storageProvider === archiveS3StorageProvider.providerId) {
    await archiveS3StorageProvider.delete(file.storageKey);
  }

  await (archivePrisma as unknown as ArchiveFileDiscardQueryClient).archiveFile.delete({ where: { id: fileId } });
  await prisma.archiveItemFileSection.deleteMany({ where: { companyId, tenantId, fileId } });

  return { ok: true };
}
