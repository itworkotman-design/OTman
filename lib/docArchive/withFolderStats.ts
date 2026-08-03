import type { ArchiveFolder } from "@customprojects/custom-archive";
import { getFolderEntryCounts, getFolderViewerCounts } from "@/lib/docArchive/folderStats";
import { getFolderCodes, getFolderSectionIds } from "@/lib/docArchive/folderCodes";

export type ArchiveFolderWithStats = ArchiveFolder & {
  entryCount: number;
  viewerCount: number;
  code: string;
  sectionId: string | null;
};

// Shared by every route that returns a list of folders to the archive UI
// (root list, child list) so entryCount/viewerCount/code/sectionId are
// attached consistently rather than duplicated per route.
export async function withFolderStats(
  companyId: string,
  tenantId: string,
  folders: ArchiveFolder[],
): Promise<ArchiveFolderWithStats[]> {
  if (folders.length === 0) return [];

  const folderIds = folders.map((folder) => folder.id);
  const [entryCounts, viewerCounts, codes, sectionIds] = await Promise.all([
    getFolderEntryCounts(companyId, tenantId, folderIds),
    getFolderViewerCounts(companyId, tenantId, folderIds),
    getFolderCodes(companyId, tenantId, folderIds),
    getFolderSectionIds(folderIds),
  ]);

  return folders.map((folder) => ({
    ...folder,
    entryCount: entryCounts.get(folder.id) ?? 0,
    viewerCount: viewerCounts.get(folder.id) ?? 0,
    code: codes.get(folder.id) ?? "?",
    sectionId: sectionIds.get(folder.id) ?? null,
  }));
}
