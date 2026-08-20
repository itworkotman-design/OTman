import { prisma } from "@/lib/db";
import { getModuleAccess } from "@/lib/users/access";
import { getArchiveTenantRoleIds, reconcileArchiveRoleAssignment } from "@/lib/docArchive/tenantRoles";

// Keeps a membership's ArchiveRoleAssignment in sync with their current
// ARCHIVE MembershipAppAccess row, so the Admin/Viewer default-access
// cascade (see grantDefaultRoleAccessOnRootFolder in context.ts) reflects
// who's currently an Archive-Admin/Viewer, not a snapshot from whenever
// each folder happened to be created. Call after any write to that row —
// see the three call sites: app/api/auth/memberships/[membershipId]/
// app-access/route.ts, lib/auth/userCreate.ts, lib/auth/inviteAccept.ts
// (confirmed to be the only three places ARCHIVE's MembershipAppAccess row
// is ever written).
//
// A no-op if this tenant hasn't bootstrapped its Archive roles yet (nobody
// has created a root folder there) — ensureArchiveTenantRoles' own
// first-time backfill, or the one-off scripts/backfill-archive-roles.ts
// migration script, catches every membership up once that happens.
export async function syncArchiveRoleAssignment(companyId: string, tenantId: string, userId: string): Promise<void> {
  const roleIds = await getArchiveTenantRoleIds(companyId);
  if (!roleIds) return;

  const membership = await prisma.membership.findFirst({
    where: { companyId, userId, status: "ACTIVE" },
    select: { appAccess: { select: { module: true, enabled: true, level: true } } },
  });
  if (!membership) return;

  const access = getModuleAccess(membership, "ARCHIVE");
  await reconcileArchiveRoleAssignment(companyId, tenantId, userId, roleIds, access);
}
