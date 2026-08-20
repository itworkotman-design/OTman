import type { ArchiveContextInput, ArchiveItem } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { getItemCodes, getItemSectionIds } from "@/lib/docArchive/folderCodes";
import { getItemViewerCounts } from "@/lib/docArchive/folderStats";

export type ArchiveItemWithStats = ArchiveItem & {
  code: string;
  sectionId: string | null;
  isPinned: boolean;
  viewerCount: number;
};

// Mirrors withFolderStats.ts — shared by every route that returns a list of
// items so code/sectionId/isPinned/viewerCount are attached consistently.
// isPinned comes from the package's own listPinnedItems (0.2.0 delivery), a
// per-user preference, so this needs ctx (not just companyId/tenantId). A
// failed pin lookup degrades to "nothing pinned" rather than failing the
// whole listing. Unlike folders, items have no entryCount — they're leaf
// nodes with nothing under them to count.
export async function withItemStats(
  ctx: ArchiveContextInput,
  items: ArchiveItem[],
): Promise<ArchiveItemWithStats[]> {
  if (items.length === 0) return [];

  const { companyId, tenantId } = ctx;
  const itemIds = items.map((item) => item.id);
  const [codes, sectionIds, pinnedResult, viewerCounts] = await Promise.all([
    getItemCodes(companyId, tenantId, items.map((item) => ({ id: item.id, folderId: item.folderId }))),
    getItemSectionIds(itemIds),
    archive.listPinnedItems(ctx),
    getItemViewerCounts(companyId, tenantId, items.map((item) => ({ id: item.id, folderId: item.folderId }))),
  ]);
  const pinnedIds = new Set(pinnedResult.ok ? pinnedResult.value.map((item) => item.id) : []);

  return items.map((item) => ({
    ...item,
    code: codes.get(item.id) ?? "?",
    sectionId: sectionIds.get(item.id) ?? null,
    isPinned: pinnedIds.has(item.id),
    viewerCount: viewerCounts.get(item.id) ?? 0,
  }));
}
