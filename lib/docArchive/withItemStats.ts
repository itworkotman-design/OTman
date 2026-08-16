import type { ArchiveContextInput, ArchiveItem } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { getItemCodes, getItemSectionIds } from "@/lib/docArchive/folderCodes";

export type ArchiveItemWithStats = ArchiveItem & {
  code: string;
  sectionId: string | null;
  isPinned: boolean;
};

// Mirrors withFolderStats.ts — shared by every route that returns a list of
// items so code/sectionId/isPinned are attached consistently. isPinned comes
// from the package's own listPinnedItems (0.2.0 delivery), a per-user
// preference, so this needs ctx (not just companyId/tenantId). A failed pin
// lookup degrades to "nothing pinned" rather than failing the whole listing.
export async function withItemStats(
  ctx: ArchiveContextInput,
  items: ArchiveItem[],
): Promise<ArchiveItemWithStats[]> {
  if (items.length === 0) return [];

  const { companyId, tenantId } = ctx;
  const itemIds = items.map((item) => item.id);
  const [codes, sectionIds, pinnedResult] = await Promise.all([
    getItemCodes(companyId, tenantId, items.map((item) => ({ id: item.id, folderId: item.folderId }))),
    getItemSectionIds(itemIds),
    archive.listPinnedItems(ctx),
  ]);
  const pinnedIds = new Set(pinnedResult.ok ? pinnedResult.value.map((item) => item.id) : []);

  return items.map((item) => ({
    ...item,
    code: codes.get(item.id) ?? "?",
    sectionId: sectionIds.get(item.id) ?? null,
    isPinned: pinnedIds.has(item.id),
  }));
}
