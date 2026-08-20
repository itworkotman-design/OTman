import type { ArchiveContextInput, ArchivePermissionAction } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { getModuleAccess } from "@/lib/users/access";
import { ARCHIVE_ADMIN_ACTIONS, ARCHIVE_VIEWER_ACTIONS } from "@/lib/docArchive/context";

// A sharing group (an arbitrary named ArchiveRole — see ArchiveRolesPanel.tsx
// and FolderSharingPanel.tsx's "Group" option) is just a list of employees;
// it carries no capability of its own. Per explicit product decision, a
// group's members' actual capability on a folder/item ALWAYS matches their
// own real company Archive role (Admin -> can edit, Viewer -> can only
// view), never a level picked once for the whole group — a group with a mix
// of Admins and Viewers must render each member's own real capability.
//
// The package's permission model can't express that with a single rule: one
// ArchivePermission row applies one action set to every member of its
// subject role uniformly (see effective-authorization.js's
// resolveDirectPermissionDecision — no per-member differentiation within a
// role). So "share with group G" is implemented here as a snapshot fan-out:
// read G's current members, look up each member's current Archive level,
// and grant each one a DIRECT per-user rule with the bundle their level
// implies — exactly the single-coworker share path
// (FolderSharingPanel.tsx's actionsForCoworker), just applied to every
// current member of G in one action. Same "snapshot at the moment of
// sharing, not an ongoing sync" precedent as copyParentFolderPermissions in
// context.ts — someone added to G later isn't retroactively included; the
// owner re-shares with the group to pick up new members, and every granted
// member shows up afterward as an ordinary individual grant in the "Users
// with access" list (each with their own correctly-derived badge), not
// under "Groups with access" — the share is genuinely per-person now.

type ArchiveRawQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};
const archiveDb = archivePrisma as unknown as ArchiveRawQueryClient;

export type ArchiveLevel = "ADMIN" | "VIEWER";

export function actionsForArchiveLevel(level: ArchiveLevel, alsoManageSharing: boolean): ArchivePermissionAction[] {
  const base = level === "ADMIN" ? ARCHIVE_ADMIN_ACTIONS : ARCHIVE_VIEWER_ACTIONS;
  return alsoManageSharing ? [...base, "manage_permissions"] : base;
}

export async function getArchiveLevelForUser(companyId: string, userId: string): Promise<ArchiveLevel> {
  const membership = await prisma.membership.findFirst({
    where: { companyId, userId, status: "ACTIVE" },
    select: { appAccess: { select: { module: true, enabled: true, level: true } } },
  });
  if (!membership) return "VIEWER";
  return getModuleAccess(membership, "ARCHIVE").level === "ADMIN" ? "ADMIN" : "VIEWER";
}

// Same raw-query pattern as folderStats.ts's getActiveRoleMembers — reads
// the archive-owned assignment table directly rather than the package's own
// listArchiveRoleAssignmentsForRole, which requires the CALLER to hold
// effective namespace manage_permissions (a company Archive-Admin sharing a
// folder they own has no reason to hold that tenant-wide authority).
async function getArchiveRoleMemberIds(companyId: string, tenantId: string, roleId: string): Promise<string[]> {
  const rows = await archiveDb.$queryRawUnsafe<{ platformUserId: string }[]>(
    `
    SELECT "platformUserId" AS "platformUserId"
    FROM archive."archive_role_assignments"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "roleId" = $3 AND "removedAt" IS NULL
    `,
    companyId,
    tenantId,
    roleId,
  );
  return rows.map((row) => row.platformUserId);
}

export type GroupShareResult = { adminCount: number; viewerCount: number };

// Grants every current member of `roleId` a direct rule on `targetId`, with
// the action bundle chosen per member from their own current Archive level.
// Returns how many members landed in each bucket, so the caller can show a
// concrete confirmation ("Shared with 3 admins and 5 viewers") instead of a
// silent group-shaped no-op. Access is purely additive — there is no "deny"
// path; un-sharing a group member is done by revoking their resulting direct
// row (see the permissions route's DELETE), never by granting a block.
export async function expandGroupShare(
  ctx: ArchiveContextInput,
  roleId: string,
  targetType: "folder" | "item",
  targetId: string,
  alsoManageSharing: boolean,
): Promise<GroupShareResult> {
  const memberIds = await getArchiveRoleMemberIds(ctx.companyId, ctx.tenantId, roleId);

  let adminCount = 0;
  let viewerCount = 0;

  for (const memberId of memberIds) {
    const level = await getArchiveLevelForUser(ctx.companyId, memberId);
    if (level === "ADMIN") adminCount += 1;
    else viewerCount += 1;

    const actions = actionsForArchiveLevel(level, alsoManageSharing);
    for (const action of actions) {
      const result = await archive.setPermissionRule(ctx, {
        targetType,
        targetId,
        subjectType: "user",
        subjectId: memberId,
        action,
        effect: "allow",
      });

      if (!result.ok) {
        throw new Error(
          `Failed to grant group member "${memberId}" "${action}" capability: ${result.error.message}`,
        );
      }
    }
  }

  return { adminCount, viewerCount };
}
