import { prisma } from "@/lib/db";
import { archivePrisma } from "@/lib/docArchive/client";
import { getFileSectionMap } from "@/lib/docArchive/contentSections";
import { getViewableFolderIds } from "@/lib/docArchive/folderStats";
import { getItemCodes } from "@/lib/docArchive/folderCodes";
import { scopedFolderIdSet, escapeLikePattern } from "@/lib/docArchive/archiveTreeScope";
import type { SpreadsheetData } from "@/lib/docArchive/spreadsheetShared";
import type { ArchiveContentSectionType } from "@prisma/client";

// Same reasoning as runArchiveRetentionSweep.ts's ArchiveFilePurgeCandidateQueryClient:
// `archivePrisma` is typed narrowly on purpose (only the package's own
// delegate shapes), but at runtime it's a full generated PrismaClient, so
// `archiveFile`/`archiveItem` genuinely exist — this local type is scoped to
// exactly the lookups this file needs.
type ArchiveContentSourceClient = {
  archiveFile: {
    findMany(args: {
      where: {
        companyId: string;
        tenantId: string;
        deletedAt: null;
        originalFileName?: { contains: string; mode: "insensitive" };
        id?: { in: string[] };
      };
      select: { id: true; archiveItemId: true; originalFileName: true; mimeType: true };
      take?: number;
    }): Promise<{ id: string; archiveItemId: string; originalFileName: string; mimeType: string }[]>;
  };
  archiveItem: {
    findMany(args: {
      where: { id: { in: string[] }; companyId: string; tenantId: string; deletedAt: null; status: "active" };
      select: { id: true; folderId: true; name: true };
    }): Promise<{ id: string; folderId: string; name: string }[]>;
  };
};

const archiveDb = archivePrisma as unknown as ArchiveContentSourceClient;

// Same "small dropdown, not a results page" reasoning as searchArchiveTree.ts.
const CANDIDATE_LIMIT = 25;
const MATCH_LIMIT = 20;

type ArchiveContentMatchBase = {
  itemId: string;
  itemName: string;
  itemCode: string;
  folderId: string;
};

export type ArchiveContentMatch = ArchiveContentMatchBase &
  (
    | { kind: "textField"; label: string; value: string }
    | { kind: "title"; text: string }
    | { kind: "fileDescription"; fileName: string | null; description: string; isImage: boolean }
    | { kind: "fileName"; fileName: string; isImage: boolean }
    | { kind: "spreadsheetCell"; value: string; column: string; row: number }
  );

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type SpreadsheetRow = { id: string; itemId: string; data: unknown };

// No indexable text column for a JSON blob, so this is a coarse prefilter —
// the real match (and its cell coordinates) is found by scanning the already
//-small candidate set in JS below.
async function findSpreadsheetCandidates(
  companyId: string,
  tenantId: string,
  likePattern: string,
): Promise<SpreadsheetRow[]> {
  return prisma.$queryRawUnsafe<SpreadsheetRow[]>(
    `SELECT "id" AS "id", "itemId" AS "itemId", "data" AS "data"
     FROM "ArchiveItemSpreadsheet"
     WHERE "companyId" = $1 AND "tenantId" = $2 AND "data"::text ILIKE $3
     LIMIT $4`,
    companyId,
    tenantId,
    likePattern,
    CANDIDATE_LIMIT,
  );
}

type SpreadsheetCellMatch = { itemId: string; value: string; column: string; row: number };

// One match per spreadsheet — enough to link to the right sheet without one
// wide grid flooding the dropdown with every matching cell in it. `row: -1`
// marks a column-header match rather than a data row (grids are capped at
// 200x50, so scanning a candidate's full grid here is cheap).
function findFirstCellMatch(row: SpreadsheetRow, lowerQuery: string): SpreadsheetCellMatch | null {
  const data = row.data as SpreadsheetData;
  if (!data?.cells || !data.columnNames) return null;

  for (const columnName of data.columnNames) {
    if (columnName?.toLowerCase().includes(lowerQuery)) {
      return { itemId: row.itemId, value: columnName, column: columnName, row: -1 };
    }
  }

  for (let r = 0; r < data.cells.length; r++) {
    const cells = data.cells[r] ?? [];
    for (let c = 0; c < cells.length; c++) {
      const value = cells[c]?.value ?? "";
      if (value.toLowerCase().includes(lowerQuery)) {
        return { itemId: row.itemId, value, column: data.columnNames[c] ?? `#${c + 1}`, row: r + 1 };
      }
    }
  }
  return null;
}

type PendingMatch = { itemId: string } & (
  | { kind: "textField"; label: string; value: string }
  | { kind: "title"; text: string }
  | { kind: "fileDescription"; fileId: string; description: string }
  | { kind: "fileName"; fileId: string; fileName: string }
  | { kind: "spreadsheetCell"; value: string; column: string; row: number }
);

// Searches item CONTENT — text-field labels/values, "Title" section
// headings, file/image names, file descriptions, and spreadsheet cells —
// as opposed to searchArchiveTree.ts, which searches folder/item name,
// description, and display code. Content lives in this app's own DB
// (ArchiveItemTextField etc.), cross-referenced with the archive package's
// own DB (archive_files, for names) by opaque itemId/fileId, same as
// searchArchiveTree.ts does for permission filtering — no Prisma relation,
// no SQL join possible across the two.
export async function searchArchiveContent(
  companyId: string,
  tenantId: string,
  userId: string,
  scopeFolderId: string | null,
  rawQuery: string,
): Promise<ArchiveContentMatch[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const containsFilter = { contains: query, mode: "insensitive" as const };
  const likePattern = `%${escapeLikePattern(query)}%`;
  const lowerQuery = query.toLowerCase();

  const [textFieldRows, titleRows, fileDescRows, fileNameRows, spreadsheetCandidates] = await Promise.all([
    prisma.archiveItemTextField.findMany({
      where: { companyId, tenantId, OR: [{ label: containsFilter }, { value: containsFilter }] },
      select: { itemId: true, label: true, value: true },
      take: CANDIDATE_LIMIT,
    }),
    prisma.archiveItemTitle.findMany({
      where: { companyId, tenantId, text: containsFilter },
      select: { itemId: true, text: true },
      take: CANDIDATE_LIMIT,
    }),
    prisma.archiveFileDescription.findMany({
      where: { companyId, tenantId, description: containsFilter },
      select: { fileId: true, description: true },
      take: CANDIDATE_LIMIT,
    }),
    archiveDb.archiveFile.findMany({
      where: { companyId, tenantId, deletedAt: null, originalFileName: containsFilter },
      select: { id: true, archiveItemId: true, originalFileName: true, mimeType: true },
      take: CANDIDATE_LIMIT,
    }),
    findSpreadsheetCandidates(companyId, tenantId, likePattern),
  ]);

  const spreadsheetMatches = spreadsheetCandidates
    .map((row) => findFirstCellMatch(row, lowerQuery))
    .filter((m): m is SpreadsheetCellMatch => m !== null);

  // File-description matches only carry a fileId — resolve each to its
  // owning item + name (fileNameRows already carries this for name matches).
  const descFileIds = fileDescRows.map((row) => row.fileId);
  const descFiles = descFileIds.length
    ? await archiveDb.archiveFile.findMany({
        where: { companyId, tenantId, deletedAt: null, id: { in: descFileIds } },
        select: { id: true, archiveItemId: true, originalFileName: true, mimeType: true },
      })
    : [];
  const descFileById = new Map(descFiles.map((f) => [f.id, f]));
  const fileNameRowById = new Map(fileNameRows.map((f) => [f.id, f]));

  const pending: PendingMatch[] = [];
  for (const row of textFieldRows) {
    // Both label and value are stored as sanitized rich-text HTML (see
    // ArchiveItemTextField) — stripped the same way title's `text` already
    // is just above, so a search snippet never shows raw markup.
    pending.push({ itemId: row.itemId, kind: "textField", label: stripHtml(row.label), value: stripHtml(row.value) });
  }
  for (const row of titleRows) {
    pending.push({ itemId: row.itemId, kind: "title", text: stripHtml(row.text) });
  }
  for (const row of fileDescRows) {
    const file = descFileById.get(row.fileId);
    if (!file) continue;
    pending.push({ itemId: file.archiveItemId, kind: "fileDescription", fileId: row.fileId, description: row.description });
  }
  for (const row of fileNameRows) {
    pending.push({ itemId: row.archiveItemId, kind: "fileName", fileId: row.id, fileName: row.originalFileName });
  }
  for (const m of spreadsheetMatches) {
    pending.push({ itemId: m.itemId, kind: "spreadsheetCell", value: m.value, column: m.column, row: m.row });
  }

  if (pending.length === 0) return [];

  const itemIds = [...new Set(pending.map((p) => p.itemId))];
  const items = await archiveDb.archiveItem.findMany({
    where: { id: { in: itemIds }, companyId, tenantId, deletedAt: null, status: "active" },
    select: { id: true, folderId: true, name: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  // Only fetch the subtree when scoping to a folder — with no scope, every
  // match already belongs to this company/tenant, so there's nothing more to
  // filter (mirrors searchArchiveTree.ts's "root folder's subtree is the
  // whole archive" framing).
  const scopedIds = scopeFolderId ? await scopedFolderIdSet(companyId, tenantId, scopeFolderId) : null;

  // Same rule as searchArchiveTree.ts: items have no permissions of their
  // own, visibility is entirely their containing folder's.
  const candidateFolderIds = new Set<string>();
  for (const item of itemById.values()) {
    if (!scopedIds || scopedIds.has(item.folderId)) candidateFolderIds.add(item.folderId);
  }
  const viewableFolderIds = await getViewableFolderIds(companyId, tenantId, userId, [...candidateFolderIds]);

  function resolveItem(itemId: string): { folderId: string; name: string } | null {
    const item = itemById.get(itemId);
    if (!item) return null;
    if (scopedIds && !scopedIds.has(item.folderId)) return null;
    if (!viewableFolderIds.has(item.folderId)) return null;
    return item;
  }

  const filtered = pending.filter((p) => resolveItem(p.itemId) !== null).slice(0, MATCH_LIMIT);
  if (filtered.length === 0) return [];

  // fileId -> sectionId (file/image matches don't carry a sectionId the way
  // text-field/title/spreadsheet rows do) and sectionId -> type, to tell an
  // image match from a plain file match.
  const fileIdsNeedingSection = [
    ...new Set(filtered.flatMap((p) => (p.kind === "fileName" || p.kind === "fileDescription" ? [p.fileId] : []))),
  ];
  const fileSectionMap = await getFileSectionMap(fileIdsNeedingSection);
  const sectionIds = [...new Set(fileSectionMap.values())];
  const sectionTypes = sectionIds.length
    ? await prisma.archiveItemContentSection.findMany({
        where: { id: { in: sectionIds } },
        select: { id: true, type: true },
      })
    : [];
  const sectionTypeById = new Map<string, ArchiveContentSectionType>(sectionTypes.map((s) => [s.id, s.type]));

  function isImageFile(fileId: string, mimeType: string): boolean {
    const sectionId = fileSectionMap.get(fileId);
    const type = sectionId ? sectionTypeById.get(sectionId) : undefined;
    if (type) return type === "IMAGES";
    return mimeType.startsWith("image/");
  }

  const itemCodes = await getItemCodes(
    companyId,
    tenantId,
    [...new Set(filtered.map((p) => p.itemId))].map((id) => ({ id, folderId: itemById.get(id)!.folderId })),
  );

  return filtered.map((p): ArchiveContentMatch => {
    const item = itemById.get(p.itemId)!;
    const base: ArchiveContentMatchBase = {
      itemId: p.itemId,
      itemName: item.name,
      itemCode: itemCodes.get(p.itemId) ?? "?",
      folderId: item.folderId,
    };

    switch (p.kind) {
      case "textField":
        return { ...base, kind: "textField", label: p.label, value: p.value };
      case "title":
        return { ...base, kind: "title", text: p.text };
      case "fileDescription": {
        const file = descFileById.get(p.fileId)!;
        return {
          ...base,
          kind: "fileDescription",
          fileName: file.originalFileName,
          description: p.description,
          isImage: isImageFile(p.fileId, file.mimeType),
        };
      }
      case "fileName": {
        const file = fileNameRowById.get(p.fileId)!;
        return {
          ...base,
          kind: "fileName",
          fileName: p.fileName,
          isImage: isImageFile(p.fileId, file.mimeType),
        };
      }
      case "spreadsheetCell":
        return { ...base, kind: "spreadsheetCell", value: p.value, column: p.column, row: p.row };
    }
  });
}
