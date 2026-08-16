import type { ArchiveContextInput, ArchiveFolder } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { getFolderEntryCounts, getFolderViewerCounts } from "@/lib/docArchive/folderStats";
import { getFolderCodes, getFolderSectionIds } from "@/lib/docArchive/folderCodes";

export type ArchiveFolderWithStats = ArchiveFolder & {
  entryCount: number;
  viewerCount: number;
  code: string;
  sectionId: string | null;
  isPinned: boolean;
};

// Shared by every route that returns a list of folders to the archive UI
// (root list, child list) so entryCount/viewerCount/code/sectionId/isPinned
// are attached consistently rather than duplicated per route. isPinned comes
// from the package's own listPinnedFolders (0.2.0 delivery) — a per-user
// preference, so this needs ctx (not just companyId/tenantId) to resolve the
// caller's own pins. A failed pin lookup degrades to "nothing pinned" rather
// than failing the whole listing, since pin state is decorative to this
// response, not load-bearing.
export async function withFolderStats(
  ctx: ArchiveContextInput,
  folders: ArchiveFolder[],
): Promise<ArchiveFolderWithStats[]> {
  if (folders.length === 0) return [];

  const { companyId, tenantId } = ctx;
  const folderIds = folders.map((folder) => folder.id);
  const [entryCounts, viewerCounts, codes, sectionIds, pinnedResult] = await Promise.all([
    getFolderEntryCounts(companyId, tenantId, folderIds),
    getFolderViewerCounts(companyId, tenantId, folderIds),
    getFolderCodes(companyId, tenantId, folderIds),
    getFolderSectionIds(folderIds),
    archive.listPinnedFolders(ctx),
  ]);
  const pinnedIds = new Set(pinnedResult.ok ? pinnedResult.value.map((folder) => folder.id) : []);

  return folders.map((folder) => ({
    ...folder,
    entryCount: entryCounts.get(folder.id) ?? 0,
    viewerCount: viewerCounts.get(folder.id) ?? 0,
    code: codes.get(folder.id) ?? "?",
    sectionId: sectionIds.get(folder.id) ?? null,
    isPinned: pinnedIds.has(folder.id),
  }));
}
