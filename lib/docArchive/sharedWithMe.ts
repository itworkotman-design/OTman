import { archivePrisma } from "@/lib/docArchive/client";
import type { ArchivePermissionEffect, ArchivePermissionSubjectType } from "@customprojects/custom-archive";

// Same "archivePrisma is really a full PrismaClient at runtime, only its
// exported TS type hides $queryRawUnsafe" pattern as folderStats.ts.
type ArchiveSharedQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

const db = archivePrisma as unknown as ArchiveSharedQueryClient;

type DirectGrantRow = {
  targetType: "folder" | "item";
  targetId: string;
  subjectType: ArchivePermissionSubjectType;
  effect: ArchivePermissionEffect;
};

export type SharedWithMeTargets = {
  folderIds: string[];
  itemIds: string[];
};

// Folders/items the user has a DIRECT `view` grant on (not merely inherited
// dynamically from an ancestor) — the source list for "Shared with me": a
// Google-Drive-style entry point for content the viewer can't browse down to
// top-down because they lack `view` on one or more of its ancestors (see
// listChildFolders'/resolveCodePath's per-level ancestor requirement).
// Applies the package's own single-target precedence rule
// (resolveDirectPermissionDecision in effective-authorization.js): a direct
// user rule at the target decides outright; otherwise a role deny beats a
// role allow; otherwise no decision. Ancestor rules play no part here by
// design — that's exactly the access this entry point exists to bypass, and
// the reason this can't reuse getViewableFolderIds/getFolderViewerCounts'
// ancestor-chain walk in folderStats.ts.
export async function listDirectlyGrantedTargets(
  companyId: string,
  tenantId: string,
  userId: string,
): Promise<SharedWithMeTargets> {
  const roleRows = await db.$queryRawUnsafe<{ roleId: string }[]>(
    `
    SELECT "roleId" AS "roleId"
    FROM archive."archive_role_assignments"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "platformUserId" = $3 AND "removedAt" IS NULL
    `,
    companyId,
    tenantId,
    userId,
  );
  const roleIds = roleRows.map((row) => row.roleId);

  const rows = await db.$queryRawUnsafe<DirectGrantRow[]>(
    `
    SELECT "targetType" AS "targetType", "targetId" AS "targetId", "subjectType" AS "subjectType", "effect" AS "effect"
    FROM archive."archive_permissions"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "action" = 'view' AND "revokedAt" IS NULL
      AND "targetType" IN ('folder', 'item')
      AND (
        ("subjectType" = 'user' AND "subjectId" = $3)
        OR ("subjectType" = 'role' AND "subjectId" = ANY($4::text[]))
      )
    `,
    companyId,
    tenantId,
    userId,
    roleIds,
  );

  const rowsByTarget = new Map<string, DirectGrantRow[]>();
  for (const row of rows) {
    const list = rowsByTarget.get(row.targetId) ?? [];
    list.push(row);
    rowsByTarget.set(row.targetId, list);
  }

  const allowedFolderIds: string[] = [];
  const allowedItemIds: string[] = [];

  for (const [targetId, rulesAtTarget] of rowsByTarget) {
    const userRule = rulesAtTarget.find((rule) => rule.subjectType === "user");
    const decision: ArchivePermissionEffect | "none" = userRule
      ? userRule.effect
      : rulesAtTarget.some((rule) => rule.subjectType === "role" && rule.effect === "deny")
        ? "deny"
        : rulesAtTarget.some((rule) => rule.subjectType === "role" && rule.effect === "allow")
          ? "allow"
          : "none";

    if (decision !== "allow") continue;
    if (rulesAtTarget[0].targetType === "folder") {
      allowedFolderIds.push(targetId);
    } else {
      allowedItemIds.push(targetId);
    }
  }

  if (allowedFolderIds.length === 0 && allowedItemIds.length === 0) {
    return { folderIds: [], itemIds: [] };
  }

  const [activeFolders, activeItems] = await Promise.all([
    // Root folders (parentFolderId IS NULL) are excluded even when they
    // matched above — every root folder now carries the Admin/Viewer role's
    // default grant directly (see grantDefaultRoleAccessOnRootFolder in
    // context.ts), so without this every root folder would show up here for
    // every Admin/Viewer, even though it's already reachable by normal
    // top-down browsing from the archive root. This entry point exists for
    // content ancestor-blocked from normal browsing — a root folder, having
    // no ancestors, is never in that position.
    allowedFolderIds.length > 0
      ? db.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" AS "id" FROM archive."archive_folders" WHERE "id" = ANY($1::uuid[]) AND "deletedAt" IS NULL AND "parentFolderId" IS NOT NULL`,
          allowedFolderIds,
        )
      : Promise.resolve([]),
    allowedItemIds.length > 0
      ? db.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" AS "id" FROM archive."archive_items" WHERE "id" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
          allowedItemIds,
        )
      : Promise.resolve([]),
  ]);

  return {
    folderIds: activeFolders.map((row) => row.id),
    itemIds: activeItems.map((row) => row.id),
  };
}
