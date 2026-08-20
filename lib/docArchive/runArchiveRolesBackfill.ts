import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archivePrisma } from "@/lib/docArchive/client";
import { ensureNamespaceManager, grantDefaultRoleAccessOnRootFolder } from "@/lib/docArchive/context";
import { ensureArchiveTenantRoles, getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";
import { syncArchiveRoleAssignment } from "@/lib/docArchive/roleSync";

// One-off production migration for the role-based Archive permission model:
// bootstraps each company's two durable "Admin"/"Viewer" Archive roles,
// syncs every active membership into the right one based on their current
// ARCHIVE MembershipAppAccess, and grants the default role-based access
// rows on every existing root folder (subfolders inherit it automatically —
// see grantDefaultRoleAccessOnRootFolder in context.ts). Exposed as a
// cron-secret-gated route (app/api/cron/archive-backfill-roles/route.ts)
// rather than a local script, following runArchiveDisplayCodeBackfill.ts's
// precedent — a plain `tsx` script importing anything that touches
// @customprojects/custom-archive fails with ERR_PACKAGE_PATH_NOT_EXPORTED
// (tsx resolves .ts files via require() by default; the package only
// exposes an "import" condition), even though the exact same code runs
// fine under Next.js's own bundler.
//
// `apply=false` (the route's default) only reports what it would do —
// nothing is written. This touches production permission data; review the
// dry-run output before the real run.
//
// Deliberately does NOT auto-revoke the old per-user bulk-admin grants
// (from the retired grantAllAdminsFolderCapabilities) that may still sit on
// folders created before this migration. Those rows are byte-identical to
// what a folder owner's own "Full access" share via the Sharing panel
// produces — there is no reliable way to tell "leftover from the old
// auto-share bug" apart from "someone deliberately gave a specific person
// full access" from the data alone, so silently revoking by pattern-match
// risks quietly removing a real, intended share. Instead this reports every
// folder/user pair that carries the full legacy action bundle so a human
// can review and, if it really is a leftover, remove it per-folder through
// the normal Sharing panel "Remove" action.

type ArchiveRawQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};
const archiveDb = archivePrisma as unknown as ArchiveRawQueryClient;

// The exact 10-action set grantAllAdminsFolderCapabilities used to write
// per admin, per folder — see the module comment on why matches are
// reported, not auto-revoked.
const LEGACY_BULK_ACTIONS = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
  "manage_permissions",
];

export type ArchiveRolesBackfillCompanySummary = {
  companyId: string;
  skipped: boolean;
  rolesAlreadyBootstrapped: boolean;
  adminRoleId: string | null;
  viewerRoleId: string | null;
  activeMembersCount: number;
  rootFoldersCount: number;
  rootFoldersGranted: number;
  legacyBulkGrantPairs: { folderId: string; userId: string }[];
};

export type ArchiveRolesBackfillSummary = {
  apply: boolean;
  companies: ArchiveRolesBackfillCompanySummary[];
};

async function findRootFolders(companyId: string, tenantId: string): Promise<{ id: string; ownerUserId: string }[]> {
  return archiveDb.$queryRawUnsafe<{ id: string; ownerUserId: string }[]>(
    `
    SELECT "id" AS "id", "ownerUserId" AS "ownerUserId"
    FROM archive."archive_folders"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "parentFolderId" IS NULL AND "deletedAt" IS NULL
    `,
    companyId,
    tenantId,
  );
}

async function findLegacyBulkGrants(
  companyId: string,
  tenantId: string,
): Promise<{ targetId: string; subjectId: string }[]> {
  return archiveDb.$queryRawUnsafe<{ targetId: string; subjectId: string }[]>(
    `
    SELECT "targetId" AS "targetId", "subjectId" AS "subjectId"
    FROM archive."archive_permissions"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "targetType" = 'folder' AND "subjectType" = 'user'
      AND "effect" = 'allow' AND "revokedAt" IS NULL AND "action" = ANY($3::text[])
    GROUP BY "targetId", "subjectId"
    HAVING COUNT(*) = $4
    `,
    companyId,
    tenantId,
    LEGACY_BULK_ACTIONS,
    LEGACY_BULK_ACTIONS.length,
  );
}

async function findNamespaceManagerCandidate(
  companyId: string,
): Promise<{ userId: string; role: "OWNER" | "ADMIN" } | null> {
  const owner = await prisma.membership.findFirst({
    where: { companyId, status: "ACTIVE", role: "OWNER" },
    select: { userId: true },
  });
  if (owner) return { userId: owner.userId, role: "OWNER" };

  const admin = await prisma.membership.findFirst({
    where: { companyId, status: "ACTIVE", role: "ADMIN" },
    select: { userId: true },
  });
  if (admin) return { userId: admin.userId, role: "ADMIN" };

  return null;
}

async function processCompany(companyId: string, apply: boolean): Promise<ArchiveRolesBackfillCompanySummary> {
  const namespaceManagerCandidate = await findNamespaceManagerCandidate(companyId);
  if (!namespaceManagerCandidate) {
    return {
      companyId,
      skipped: true,
      rolesAlreadyBootstrapped: false,
      adminRoleId: null,
      viewerRoleId: null,
      activeMembersCount: 0,
      rootFoldersCount: 0,
      rootFoldersGranted: 0,
      legacyBulkGrantPairs: [],
    };
  }

  const bootstrapCtx: ArchiveContextInput = {
    userId: namespaceManagerCandidate.userId,
    companyId,
    tenantId: companyId,
    archiveModuleAccess: true,
  };

  let roleIds = await getArchiveTenantRoleIds(companyId);
  const rolesAlreadyBootstrapped = roleIds !== null;

  if (!roleIds && apply) {
    await ensureNamespaceManager(bootstrapCtx, namespaceManagerCandidate.role);
    roleIds = await ensureArchiveTenantRoles(bootstrapCtx);
  }

  const activeMemberships = await prisma.membership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { userId: true },
  });

  if (apply && roleIds) {
    for (const membership of activeMemberships) {
      await syncArchiveRoleAssignment(companyId, companyId, membership.userId);
    }
  }

  const rootFolders = await findRootFolders(companyId, companyId);
  let rootFoldersGranted = 0;

  if (apply) {
    for (const folder of rootFolders) {
      const folderCtx: ArchiveContextInput = {
        userId: folder.ownerUserId,
        companyId,
        tenantId: companyId,
        archiveModuleAccess: true,
      };
      try {
        await grantDefaultRoleAccessOnRootFolder(folderCtx, folder.id);
        rootFoldersGranted += 1;
      } catch (error) {
        console.error(`Archive roles backfill: failed to grant default role access on root folder ${folder.id}`, error);
      }
    }
  }

  const legacyGrants = await findLegacyBulkGrants(companyId, companyId);

  return {
    companyId,
    skipped: false,
    rolesAlreadyBootstrapped,
    adminRoleId: roleIds?.adminRoleId ?? null,
    viewerRoleId: roleIds?.viewerRoleId ?? null,
    activeMembersCount: activeMemberships.length,
    rootFoldersCount: rootFolders.length,
    rootFoldersGranted,
    legacyBulkGrantPairs: legacyGrants.map((grant) => ({ folderId: grant.targetId, userId: grant.subjectId })),
  };
}

export async function runArchiveRolesBackfill(apply: boolean): Promise<ArchiveRolesBackfillSummary> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  const companySummaries: ArchiveRolesBackfillCompanySummary[] = [];

  for (const company of companies) {
    companySummaries.push(await processCompany(company.id, apply));
  }

  return { apply, companies: companySummaries };
}
