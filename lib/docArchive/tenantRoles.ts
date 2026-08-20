import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { getModuleAccess } from "@/lib/users/access";

type ArchiveRoleAssignmentWriteClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

// Same "archivePrisma is really a full PrismaClient at runtime, only its
// exported TS type hides $queryRawUnsafe" pattern as context.ts/folderStats.ts.
const roleDb = archivePrisma as unknown as ArchiveRoleAssignmentWriteClient;

export type ArchiveTenantRoleIds = { adminRoleId: string; viewerRoleId: string };

export async function getArchiveTenantRoleIds(companyId: string): Promise<ArchiveTenantRoleIds | null> {
  const row = await prisma.archiveTenantRoles.findUnique({ where: { companyId } });
  return row ? { adminRoleId: row.adminRoleId, viewerRoleId: row.viewerRoleId } : null;
}

// Adds/removes one ArchiveRoleAssignment row directly against the
// archive-owned table, bypassing the package's own assignArchiveRole/
// unassignArchiveRole authorization gate — both require the CALLER to hold
// effective namespace manage_permissions (prisma-role-management-service.js's
// requireNamespaceManageAuthority). That's the right gate for a human
// managing roles through the Roles UI, but wrong here: this runs
// automatically whenever ANY membership's ARCHIVE module access changes
// (see roleSync.ts), triggered by whichever UM-admin happens to be editing
// that person's access — someone with no reason to hold Archive-specific
// namespace rights themselves. Same precedent as ensureNamespaceManager's
// direct insert into archive_permissions in context.ts. `archivePrisma` is
// typed narrowly but is a real Prisma client at runtime.
export async function setArchiveRoleAssignment(
  companyId: string,
  tenantId: string,
  roleId: string,
  platformUserId: string,
  assigned: boolean,
): Promise<void> {
  if (assigned) {
    await roleDb.$queryRawUnsafe(
      `
      INSERT INTO archive."archive_role_assignments"
        ("id", "companyId", "tenantId", "roleId", "platformUserId", "assignedByUserId")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $4)
      ON CONFLICT DO NOTHING
      `,
      companyId,
      tenantId,
      roleId,
      platformUserId,
    );
  } else {
    await roleDb.$queryRawUnsafe(
      `
      UPDATE archive."archive_role_assignments"
      SET "removedAt" = now(), "removedByUserId" = $4
      WHERE "companyId" = $1 AND "tenantId" = $2 AND "roleId" = $3 AND "platformUserId" = $4 AND "removedAt" IS NULL
      `,
      companyId,
      tenantId,
      roleId,
      platformUserId,
    );
  }
}

// Ensures exactly one of {adminRoleId, viewerRoleId} is active for this
// user (or neither, if their ARCHIVE access is disabled) — the single
// implementation shared by ensureArchiveTenantRoles' first-time backfill
// below and roleSync.ts's per-change sync.
export async function reconcileArchiveRoleAssignment(
  companyId: string,
  tenantId: string,
  userId: string,
  roleIds: ArchiveTenantRoleIds,
  archiveAccess: { enabled: boolean; level: string },
): Promise<void> {
  const targetRoleId = archiveAccess.enabled
    ? archiveAccess.level === "ADMIN"
      ? roleIds.adminRoleId
      : roleIds.viewerRoleId
    : null;

  await setArchiveRoleAssignment(companyId, tenantId, roleIds.adminRoleId, userId, targetRoleId === roleIds.adminRoleId);
  await setArchiveRoleAssignment(companyId, tenantId, roleIds.viewerRoleId, userId, targetRoleId === roleIds.viewerRoleId);
}

async function backfillExistingMembers(companyId: string, tenantId: string, roleIds: ArchiveTenantRoleIds): Promise<void> {
  const memberships = await prisma.membership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { userId: true, appAccess: { select: { module: true, enabled: true, level: true } } },
  });

  for (const membership of memberships) {
    const access = getModuleAccess(membership, "ARCHIVE");
    await reconcileArchiveRoleAssignment(companyId, tenantId, membership.userId, roleIds, access);
  }
}

// Bootstraps this tenant's two durable Archive roles ("Admin", "Viewer") the
// first time anyone needs them. Precondition: ctx.userId must already have
// effective namespace manage_permissions (see ensureNamespaceManager in
// context.ts) — same requirement as the existing archive.createArchiveRole
// call site in app/api/archive/roles/route.ts. Only reachable today from
// root-folder creation, right after that same call establishes it.
// Idempotent: a second call for an already-bootstrapped tenant is a plain
// read.
export async function ensureArchiveTenantRoles(ctx: ArchiveContextInput): Promise<ArchiveTenantRoleIds> {
  const existing = await getArchiveTenantRoleIds(ctx.companyId);
  if (existing) return existing;

  const adminResult = await archive.createArchiveRole(ctx, { name: "Admin" });
  if (!adminResult.ok) {
    throw new Error(`Failed to create Admin role: ${adminResult.error.message}`);
  }
  const viewerResult = await archive.createArchiveRole(ctx, { name: "Viewer" });
  if (!viewerResult.ok) {
    throw new Error(`Failed to create Viewer role: ${viewerResult.error.message}`);
  }

  const adminRoleId = adminResult.value.id;
  const viewerRoleId = viewerResult.value.id;

  // `create` is one of only two legal namespace-level actions (the other,
  // manage_permissions, is deliberately NOT granted to the Admin role — see
  // grantDefaultRoleAccessOnRootFolder's comment in context.ts) — this is
  // what lets every current/future Archive-Admin create root folders, not
  // just whoever originally bootstrapped the namespace.
  const grantResult = await archive.setPermissionRule(ctx, {
    targetType: "namespace",
    targetId: ctx.tenantId,
    subjectType: "role",
    subjectId: adminRoleId,
    action: "create",
    effect: "allow",
  });
  if (!grantResult.ok) {
    throw new Error(`Failed to grant Admin role namespace create: ${grantResult.error.message}`);
  }

  await prisma.archiveTenantRoles.create({
    data: { companyId: ctx.companyId, tenantId: ctx.tenantId, adminRoleId, viewerRoleId },
  });

  await backfillExistingMembers(ctx.companyId, ctx.tenantId, { adminRoleId, viewerRoleId });

  return { adminRoleId, viewerRoleId };
}
