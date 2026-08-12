import { archivePrisma } from "@/lib/docArchive/client";

// Same "raw SQL against archivePrisma's own schema" pattern as
// folderStats.ts's getFolderEntryCounts/getAncestorChains — the host adapter
// has no bulk "search/walk this subtree" method, only single-target
// listChildFolders/listItemsInFolder. Shared by searchArchiveTree.ts (name/
// description/code search) and searchArchiveContent.ts (item-content
// search), so both walk the same subtree the same way.
type ArchiveTreeQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

export const archiveTreeDb = archivePrisma as unknown as ArchiveTreeQueryClient;

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// `scopeFolderId` is the folder whose subtree we're walking, or null for the
// whole archive (every root folder and everything below it) — the same
// query shape either way, just a different anchor.
export const DESCENDANTS_CTE = `
  WITH RECURSIVE descendants AS (
    SELECT "id"
    FROM archive."archive_folders"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL
      AND (
        ($3::uuid IS NULL AND "parentFolderId" IS NULL)
        OR "parentFolderId" = $3::uuid
      )
    UNION ALL
    SELECT f."id"
    FROM archive."archive_folders" f
    JOIN descendants d ON f."parentFolderId" = d."id"
    WHERE f."companyId" = $1 AND f."tenantId" = $2 AND f."deletedAt" IS NULL
  )
`;

type FolderIdRow = { id: string };

// The set of active folder ids at or below `scopeFolderId` — used to check
// whether a match found by a direct text query (not itself scoped to the
// subtree) actually falls inside the folder the user is searching within.
export async function scopedFolderIdSet(
  companyId: string,
  tenantId: string,
  scopeFolderId: string | null,
): Promise<Set<string>> {
  const rows = await archiveTreeDb.$queryRawUnsafe<FolderIdRow[]>(
    `${DESCENDANTS_CTE} SELECT "id" AS "id" FROM descendants`,
    companyId,
    tenantId,
    scopeFolderId,
  );
  return new Set(rows.map((row) => row.id));
}
