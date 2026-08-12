import { getFolderCodes, getItemCodes } from "@/lib/docArchive/folderCodes";
import { getViewableFolderIds } from "@/lib/docArchive/folderStats";
import { archiveTreeDb as db, DESCENDANTS_CTE, escapeLikePattern } from "@/lib/docArchive/archiveTreeScope";

export type ArchiveTreeSearchFolder = {
  type: "folder";
  id: string;
  name: string;
  description: string | null;
  code: string;
};

export type ArchiveTreeSearchItem = {
  type: "item";
  id: string;
  folderId: string;
  name: string;
  description: string | null;
  code: string;
};

export type ArchiveTreeSearchResult = ArchiveTreeSearchFolder | ArchiveTreeSearchItem;

// Small dropdown, not a results page — enough to be useful without the
// query ever needing to return "everything under root" in full.
const TEXT_MATCH_LIMIT = 20;
const RESULT_LIMIT = 30;
// Codes aren't a column (they're computed from ArchiveFolderCode/
// ArchiveItemCode's localSeq), so matching one means fetching a batch of
// candidate ids and computing their codes to check — only worth doing when
// the query actually looks like a code fragment (digits/dots, optional
// trailing folder "F"), not on every keystroke of a free-text search. The
// trailing `\.?` lets a bare prefix like "1." through too — e.g. everything
// under folder "1" — since the substring check below already matches it
// against every descendant code once it's allowed to run.
const CODE_QUERY_PATTERN = /^[0-9]+(\.[0-9]+[fF]?)*[fF]?\.?$/;
const CODE_SCAN_LIMIT = 2000;

type FolderRow = { id: string; name: string; description: string | null };
type ItemRow = { id: string; name: string; description: string | null; folderId: string };

// Loose matching: "basefolder2subfolder" should still find
// "Base Folder 2 - Subfolder 1" — done by stripping whitespace, "-", and ","
// from both the query and the compared column before ILIKE, rather than
// requiring the query to reproduce the name's exact spacing and punctuation.
// Deliberately NOT stripping "." — codes (e.g. "1.2F") use it as a
// meaningful hierarchy separator, and this same normalization also feeds the
// code-match path, so collapsing dots there would make different codes
// (e.g. "1.23" and "1.2.3") collide.
function normalizeForMatch(value: string): string {
  return value.replace(/[\s,-]+/g, "");
}

async function findFoldersByText(
  companyId: string,
  tenantId: string,
  scopeFolderId: string | null,
  likePattern: string,
): Promise<FolderRow[]> {
  return db.$queryRawUnsafe<FolderRow[]>(
    `${DESCENDANTS_CTE}
    SELECT f."id" AS "id", f."name" AS "name", f."description" AS "description"
    FROM archive."archive_folders" f
    JOIN descendants d ON d."id" = f."id"
    WHERE f."status" = 'active'
      AND (
        regexp_replace(f."name", '[,[:space:]-]+', '', 'g') ILIKE $4
        OR regexp_replace(coalesce(f."description", ''), '[,[:space:]-]+', '', 'g') ILIKE $4
      )
    ORDER BY f."name" ASC
    LIMIT $5
    `,
    companyId,
    tenantId,
    scopeFolderId,
    likePattern,
    TEXT_MATCH_LIMIT,
  );
}

async function findItemsByText(
  companyId: string,
  tenantId: string,
  scopeFolderId: string | null,
  likePattern: string,
): Promise<ItemRow[]> {
  return db.$queryRawUnsafe<ItemRow[]>(
    `${DESCENDANTS_CTE},
    scope AS (
      SELECT "id" FROM descendants
      UNION
      SELECT $3::uuid WHERE $3::uuid IS NOT NULL
    )
    SELECT i."id" AS "id", i."name" AS "name", i."description" AS "description", i."folderId" AS "folderId"
    FROM archive."archive_items" i
    JOIN scope s ON s."id" = i."folderId"
    WHERE i."companyId" = $1 AND i."tenantId" = $2 AND i."deletedAt" IS NULL AND i."status" = 'active'
      AND (
        regexp_replace(i."name", '[,[:space:]-]+', '', 'g') ILIKE $4
        OR regexp_replace(coalesce(i."description", ''), '[,[:space:]-]+', '', 'g') ILIKE $4
      )
    ORDER BY i."name" ASC
    LIMIT $5
    `,
    companyId,
    tenantId,
    scopeFolderId,
    likePattern,
    TEXT_MATCH_LIMIT,
  );
}

async function scopedFolderCandidates(
  companyId: string,
  tenantId: string,
  scopeFolderId: string | null,
): Promise<FolderRow[]> {
  return db.$queryRawUnsafe<FolderRow[]>(
    `${DESCENDANTS_CTE}
    SELECT f."id" AS "id", f."name" AS "name", f."description" AS "description"
    FROM archive."archive_folders" f
    JOIN descendants d ON d."id" = f."id"
    WHERE f."status" = 'active'
    LIMIT $4
    `,
    companyId,
    tenantId,
    scopeFolderId,
    CODE_SCAN_LIMIT,
  );
}

async function scopedItemCandidates(
  companyId: string,
  tenantId: string,
  scopeFolderId: string | null,
): Promise<ItemRow[]> {
  return db.$queryRawUnsafe<ItemRow[]>(
    `${DESCENDANTS_CTE},
    scope AS (
      SELECT "id" FROM descendants
      UNION
      SELECT $3::uuid WHERE $3::uuid IS NOT NULL
    )
    SELECT i."id" AS "id", i."name" AS "name", i."description" AS "description", i."folderId" AS "folderId"
    FROM archive."archive_items" i
    JOIN scope s ON s."id" = i."folderId"
    WHERE i."companyId" = $1 AND i."tenantId" = $2 AND i."deletedAt" IS NULL AND i."status" = 'active'
    LIMIT $4
    `,
    companyId,
    tenantId,
    scopeFolderId,
    CODE_SCAN_LIMIT,
  );
}

// Searches everything at or below `scopeFolderId` (or the whole archive when
// null — a root folder's "subtree" is every root folder and everything
// below them, so this is naturally a global search from the archive's main
// page) by name, description, and — when the query looks code-shaped — its
// display code too. Only active folders/items are candidates, matching the
// same "status is managed from settings, not shown/searched here" rule the
// browsing views already follow.
export async function searchArchiveTree(
  companyId: string,
  tenantId: string,
  userId: string,
  scopeFolderId: string | null,
  rawQuery: string,
): Promise<ArchiveTreeSearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const likePattern = `%${escapeLikePattern(normalizeForMatch(query))}%`;

  const [textFolders, textItems] = await Promise.all([
    findFoldersByText(companyId, tenantId, scopeFolderId, likePattern),
    findItemsByText(companyId, tenantId, scopeFolderId, likePattern),
  ]);

  const folderRows = new Map<string, FolderRow>(textFolders.map((row) => [row.id, row]));
  const itemRows = new Map<string, ItemRow>(textItems.map((row) => [row.id, row]));

  const normalizedQuery = normalizeForMatch(query);

  if (CODE_QUERY_PATTERN.test(normalizedQuery)) {
    const lowerQuery = normalizedQuery.toLowerCase();

    const [folderCandidates, itemCandidates] = await Promise.all([
      scopedFolderCandidates(companyId, tenantId, scopeFolderId),
      scopedItemCandidates(companyId, tenantId, scopeFolderId),
    ]);

    const [folderCodes, itemCodes] = await Promise.all([
      getFolderCodes(companyId, tenantId, folderCandidates.map((row) => row.id)),
      getItemCodes(companyId, tenantId, itemCandidates.map((row) => ({ id: row.id, folderId: row.folderId }))),
    ]);

    for (const row of folderCandidates) {
      if (folderRows.has(row.id)) continue;
      const code = folderCodes.get(row.id);
      if (code && code.toLowerCase().includes(lowerQuery)) folderRows.set(row.id, row);
    }

    for (const row of itemCandidates) {
      if (itemRows.has(row.id)) continue;
      const code = itemCodes.get(row.id);
      if (code && code.toLowerCase().includes(lowerQuery)) itemRows.set(row.id, row);
    }
  }

  // The recursive CTEs above walk the tree with no regard for per-folder
  // sharing rules, so a candidate can be a text/code match while still being
  // a folder (or the containing folder of an item) this particular user has
  // no `view` access to — items have no permission rules of their own in
  // this app (no item-permissions route exists), so an item's visibility is
  // entirely its containing folder's. Drop anything not effectively
  // viewable before it ever reaches the client.
  const candidateFolderIds = new Set<string>(folderRows.keys());
  for (const row of itemRows.values()) candidateFolderIds.add(row.folderId);

  const viewableFolderIds = await getViewableFolderIds(companyId, tenantId, userId, [...candidateFolderIds]);

  for (const id of folderRows.keys()) {
    if (!viewableFolderIds.has(id)) folderRows.delete(id);
  }
  for (const [id, row] of itemRows) {
    if (!viewableFolderIds.has(row.folderId)) itemRows.delete(id);
  }

  const folderIds = [...folderRows.keys()];
  const itemList = [...itemRows.values()];
  const [resultFolderCodes, resultItemCodes] = await Promise.all([
    getFolderCodes(companyId, tenantId, folderIds),
    getItemCodes(companyId, tenantId, itemList.map((row) => ({ id: row.id, folderId: row.folderId }))),
  ]);

  const folderResults: ArchiveTreeSearchFolder[] = folderIds.map((id) => {
    const row = folderRows.get(id)!;
    return { type: "folder", id, name: row.name, description: row.description, code: resultFolderCodes.get(id) ?? "?" };
  });

  const itemResults: ArchiveTreeSearchItem[] = itemList.map((row) => ({
    type: "item",
    id: row.id,
    folderId: row.folderId,
    name: row.name,
    description: row.description,
    code: resultItemCodes.get(row.id) ?? "?",
  }));

  return [...folderResults, ...itemResults].slice(0, RESULT_LIMIT);
}
