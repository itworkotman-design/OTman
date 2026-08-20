import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archivePrisma } from "@/lib/docArchive/client";
import { grantDefaultRoleAccessOnRootFolder } from "@/lib/docArchive/context";
import { getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";

// One-off production migration converting folders still on the LIVE
// company-wide Admin-role default (the model grantDefaultRoleAccessOnRootFolder
// used before ArchiveFolderDefaultRole existed — see that function's header
// comment in context.ts) onto the new one-time-snapshot model. Without this,
// a folder created before the fix keeps behaving exactly like the bug
// report that prompted it: every current AND future company Admin
// continues to get automatic access to it, forever, even after this code
// ships — the fix only changes what NEW folders do.
//
// Finds every folder (root or, from the old model's copyParentFolderPermissions
// duplication, a subfolder that inherited a local copy of the same row) that
// still carries an allow rule for the company's global adminRoleId, revokes
// those rows, and calls grantDefaultRoleAccessOnRootFolder — which, despite
// the name, works on any folder id — to (re)grant access to today's Admins
// through a fresh dedicated per-folder role instead.
//
// Same cron-secret-gated dry-run-by-default shape as
// runArchiveRolesBackfill.ts/archive-backfill-roles for the same reason:
// this rewrites production permission data, so review the dry-run output
// (`apply=false`, the default) before the real run.

type ArchiveRawQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};
const archiveDb = archivePrisma as unknown as ArchiveRawQueryClient;

export type ArchiveFolderDefaultRoleBackfillCompanySummary = {
  companyId: string;
  skipped: boolean;
  legacyFolderIds: string[];
  foldersConverted: number;
};

export type ArchiveFolderDefaultRoleBackfillSummary = {
  apply: boolean;
  companies: ArchiveFolderDefaultRoleBackfillCompanySummary[];
};

async function findLegacyDefaultAccessFolders(
  companyId: string,
  tenantId: string,
  adminRoleId: string,
): Promise<{ folderId: string; ownerUserId: string }[]> {
  return archiveDb.$queryRawUnsafe<{ folderId: string; ownerUserId: string }[]>(
    `
    SELECT DISTINCT p."targetId" AS "folderId", f."ownerUserId" AS "ownerUserId"
    FROM archive."archive_permissions" p
    JOIN archive."archive_folders" f ON f."id"::text = p."targetId" AND f."companyId" = p."companyId" AND f."tenantId" = p."tenantId"
    WHERE p."companyId" = $1 AND p."tenantId" = $2 AND p."targetType" = 'folder'
      AND p."subjectType" = 'role' AND p."subjectId" = $3 AND p."effect" = 'allow' AND p."revokedAt" IS NULL
      AND f."deletedAt" IS NULL
    `,
    companyId,
    tenantId,
    adminRoleId,
  );
}

async function revokeLegacyDefaultAccessRows(
  companyId: string,
  tenantId: string,
  folderId: string,
  adminRoleId: string,
  revokedByUserId: string,
): Promise<void> {
  await archiveDb.$queryRawUnsafe(
    `
    UPDATE archive."archive_permissions"
    SET "revokedAt" = now(), "revokedByUserId" = $5
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "targetType" = 'folder' AND "targetId" = $3
      AND "subjectType" = 'role' AND "subjectId" = $4 AND "revokedAt" IS NULL
    `,
    companyId,
    tenantId,
    folderId,
    adminRoleId,
    revokedByUserId,
  );
}

async function processCompany(companyId: string, apply: boolean): Promise<ArchiveFolderDefaultRoleBackfillCompanySummary> {
  const roleIds = await getArchiveTenantRoleIds(companyId);
  if (!roleIds) {
    // Nobody has bootstrapped Archive roles for this tenant at all — no
    // root folders, so nothing to convert.
    return { companyId, skipped: true, legacyFolderIds: [], foldersConverted: 0 };
  }

  const legacyFolders = await findLegacyDefaultAccessFolders(companyId, companyId, roleIds.adminRoleId);
  let foldersConverted = 0;

  if (apply) {
    for (const folder of legacyFolders) {
      const folderCtx: ArchiveContextInput = {
        userId: folder.ownerUserId,
        companyId,
        tenantId: companyId,
        archiveModuleAccess: true,
      };
      try {
        await revokeLegacyDefaultAccessRows(companyId, companyId, folder.folderId, roleIds.adminRoleId, folder.ownerUserId);
        await grantDefaultRoleAccessOnRootFolder(folderCtx, folder.folderId);
        foldersConverted += 1;
      } catch (error) {
        console.error(`Archive folder-default-role backfill: failed to convert folder ${folder.folderId}`, error);
      }
    }
  }

  return {
    companyId,
    skipped: false,
    legacyFolderIds: legacyFolders.map((f) => f.folderId),
    foldersConverted,
  };
}

export async function runArchiveFolderDefaultRoleBackfill(apply: boolean): Promise<ArchiveFolderDefaultRoleBackfillSummary> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  const companySummaries: ArchiveFolderDefaultRoleBackfillCompanySummary[] = [];

  for (const company of companies) {
    companySummaries.push(await processCompany(company.id, apply));
  }

  return { apply, companies: companySummaries };
}
