import { prisma } from "@/lib/db";
import { ArchiveSequenceScope } from "@prisma/client";
import { getAncestorChains } from "@/lib/docArchive/folderStats";

// Stable display codes for Archive folders/items, ported from the
// otman-archive prototype's SectionItem.code scheme (e.g. "1.2F" for the
// 2nd subfolder of root folder 1, "1.2F.3" for the 3rd item inside it):
// root folders are numbered plain ("1", "2", ...); every folder below root
// gets its own local number suffixed "F" so it can't be confused with an
// item sharing the same position; items are always leaves and never get a
// suffix. Assigned once at creation (see assignFolderCode/assignItemCode)
// and never recomputed from list position, so deleting a sibling never
// changes anyone else's code.

// Sentinel for "no parent" (root scope) in ArchiveSequenceCounter.parentFolderId
// — a real column value, not SQL NULL, because Postgres treats every NULL as
// distinct and would silently defeat the one-row-per-scope @@unique
// constraint. Archive folder ids are always UUIDs, so this plain string can
// never collide with a real one. Exported for reuse by sections.ts, which
// needs the same "root vs. a real folder id" scoping for ArchiveSection.
export const ROOT_SCOPE = "root";

async function nextLocalSeq(
  scope: ArchiveSequenceScope,
  companyId: string,
  tenantId: string,
  parentFolderId: string | null,
): Promise<number> {
  const key = parentFolderId ?? ROOT_SCOPE;

  const counter = await prisma.archiveSequenceCounter.upsert({
    where: { companyId_tenantId_parentFolderId_scope: { companyId, tenantId, parentFolderId: key, scope } },
    create: { companyId, tenantId, parentFolderId: key, scope, nextSeq: 2 },
    update: { nextSeq: { increment: 1 } },
  });

  // On create, nextSeq is seeded at 2 (having just handed out 1); on update,
  // nextSeq is now old+1 (having just handed out old). Either way the seq we
  // hand out is nextSeq - 1.
  return counter.nextSeq - 1;
}

export async function assignFolderCode(
  companyId: string,
  tenantId: string,
  folderId: string,
  parentFolderId: string | null,
  sectionId: string | null,
): Promise<number> {
  const localSeq = await nextLocalSeq("FOLDER", companyId, tenantId, parentFolderId);
  await prisma.archiveFolderCode.create({ data: { companyId, tenantId, folderId, localSeq, sectionId } });
  return localSeq;
}

export async function assignItemCode(
  companyId: string,
  tenantId: string,
  itemId: string,
  folderId: string,
  sectionId: string | null,
): Promise<number> {
  const localSeq = await nextLocalSeq("ITEM", companyId, tenantId, folderId);
  await prisma.archiveItemCode.create({ data: { companyId, tenantId, itemId, localSeq, sectionId } });
  return localSeq;
}

// Batched sectionId lookups so list routes can group folders/items by
// section without an extra query per row. Missing entries (not yet
// assigned, or created before this feature existed) map to null, meaning
// "ungrouped" in the UI rather than an error.
export async function getFolderSectionIds(folderIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (folderIds.length === 0) return map;

  const rows = await prisma.archiveFolderCode.findMany({
    where: { folderId: { in: folderIds } },
    select: { folderId: true, sectionId: true },
  });

  for (const row of rows) {
    map.set(row.folderId, row.sectionId);
  }
  return map;
}

export async function getItemSectionIds(itemIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (itemIds.length === 0) return map;

  const rows = await prisma.archiveItemCode.findMany({
    where: { itemId: { in: itemIds } },
    select: { itemId: true, sectionId: true },
  });

  for (const row of rows) {
    map.set(row.itemId, row.sectionId);
  }
  return map;
}

async function getFolderLocalSeqs(folderIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (folderIds.length === 0) return map;

  const rows = await prisma.archiveFolderCode.findMany({
    where: { folderId: { in: folderIds } },
    select: { folderId: true, localSeq: true },
  });

  for (const row of rows) {
    map.set(row.folderId, row.localSeq);
  }
  return map;
}

// Full display code for each requested folder id, e.g. "1", "1.2F",
// "1.2F.1F". Missing codes (data created before this feature existed and not
// yet backfilled) render as "?" for that segment rather than throwing.
export async function getFolderCodes(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  if (folderIds.length === 0) return codes;

  const chains = await getAncestorChains(companyId, tenantId, folderIds);
  const allAncestorIds = [...new Set([...chains.values()].flat())];
  const localSeqs = await getFolderLocalSeqs(allAncestorIds);

  for (const folderId of folderIds) {
    const rootFirstChain = [...(chains.get(folderId) ?? [folderId])].reverse();

    const code = rootFirstChain
      .map((ancestorId, index) => {
        const seq = localSeqs.get(ancestorId) ?? "?";
        return index === 0 ? String(seq) : `${seq}F`;
      })
      .join(".");

    codes.set(folderId, code);
  }

  return codes;
}

// Full display code for each requested item, e.g. "1.2F.3" — its containing
// folder's own code plus its own local sequence, unsuffixed (items are
// always leaves, never confusable with a folder at the same position since
// folders and items are numbered with separate counters).
export async function getItemCodes(
  companyId: string,
  tenantId: string,
  items: { id: string; folderId: string }[],
): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  if (items.length === 0) return codes;

  const folderIds = [...new Set(items.map((item) => item.folderId))];
  const folderCodes = await getFolderCodes(companyId, tenantId, folderIds);

  const itemIds = items.map((item) => item.id);
  const rows = await prisma.archiveItemCode.findMany({
    where: { itemId: { in: itemIds } },
    select: { itemId: true, localSeq: true },
  });
  const itemLocalSeqs = new Map(rows.map((row) => [row.itemId, row.localSeq]));

  for (const item of items) {
    const folderCode = folderCodes.get(item.folderId) ?? "?";
    const seq = itemLocalSeqs.get(item.id) ?? "?";
    codes.set(item.id, `${folderCode}.${seq}`);
  }

  return codes;
}
