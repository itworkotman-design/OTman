import { archivePrisma } from "@/lib/docArchive/client";

// The otman-archive prototype's folder rows show "Entries"/"Users" columns
// (see docs/documentation/integrations/custom-archive-backend-feedback.md
// context for why FolderPill originally substituted status/due instead: the
// real ArchiveFolder has no such fields). Both counts require walking the
// folder tree / permission model in ways the host adapter's own methods don't
// expose in bulk (listChildFolders/listItemsInFolder are single-target;
// listPermissionRules requires manage_permissions on the exact target, which
// a caller with only `view` on a shared folder won't have — see
// runArchiveRetentionSweep.ts for the precedent of querying `archivePrisma`
// directly for aggregate reads the host-adapter surface doesn't cover).
//
// `archivePrisma` is typed as the package's narrow internal
// `PrismaArchiveHostAdapterClient` contract, not a general query client, but
// at runtime it's a real generated PrismaClient (createArchivePrismaClient
// just calls `new PrismaClient(options)`) — so `$queryRawUnsafe` genuinely
// works, only the exported TS type hides it. Same local-type-cast workaround
// as runArchiveRetentionSweep.ts, scoped to exactly the queries below.
type ArchiveStatsQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

const db = archivePrisma as unknown as ArchiveStatsQueryClient;

// "Entries" = this folder's own items plus every item in every descendant
// folder, recursively, matching the prototype's fake `entries` count with a
// real recursive one. Batched into one query regardless of how many folder
// ids are requested.
export async function getFolderEntryCounts(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (folderIds.length === 0) return counts;

  const rows = await db.$queryRawUnsafe<{ rootId: string; entryCount: number }[]>(
    `
    WITH RECURSIVE descendants AS (
      SELECT "id" AS folder_id, "id" AS "rootId"
      FROM archive."archive_folders"
      WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL AND "id" = ANY($3::uuid[])
      UNION ALL
      SELECT f."id", d."rootId"
      FROM archive."archive_folders" f
      JOIN descendants d ON f."parentFolderId" = d.folder_id
      WHERE f."companyId" = $1 AND f."tenantId" = $2 AND f."deletedAt" IS NULL
    )
    SELECT d."rootId" AS "rootId", COUNT(i."id")::int AS "entryCount"
    FROM descendants d
    LEFT JOIN archive."archive_items" i
      ON i."folderId" = d.folder_id AND i."companyId" = $1 AND i."tenantId" = $2 AND i."deletedAt" IS NULL
    GROUP BY d."rootId"
    `,
    companyId,
    tenantId,
    folderIds,
  );

  for (const row of rows) {
    counts.set(row.rootId, row.entryCount);
  }
  return counts;
}

// Nearest-first ancestor chain per requested folder id (folder itself first,
// root last) — shared with lib/docArchive/folderCodes.ts, which needs the
// same chain in root-first order to build display codes.
export async function getAncestorChains(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, string[]>> {
  const chains = new Map<string, string[]>();
  if (folderIds.length === 0) return chains;

  const rows = await db.$queryRawUnsafe<{ rootId: string; ancestorId: string }[]>(
    `
    WITH RECURSIVE chain AS (
      SELECT "id" AS "rootId", "id" AS "ancestorId", "parentFolderId", 0 AS depth
      FROM archive."archive_folders"
      WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL AND "id" = ANY($3::uuid[])
      UNION ALL
      SELECT c."rootId", f."id", f."parentFolderId", c.depth + 1
      FROM archive."archive_folders" f
      JOIN chain c ON f."id" = c."parentFolderId"
      WHERE f."companyId" = $1 AND f."tenantId" = $2 AND f."deletedAt" IS NULL
    )
    SELECT "rootId" AS "rootId", "ancestorId" AS "ancestorId" FROM chain ORDER BY "rootId", depth ASC
    `,
    companyId,
    tenantId,
    folderIds,
  );

  for (const row of rows) {
    const list = chains.get(row.rootId) ?? [];
    list.push(row.ancestorId);
    chains.set(row.rootId, list);
  }
  return chains;
}

type ViewRuleRow = {
  targetId: string;
  subjectType: "user" | "role";
  subjectId: string;
  effect: "allow" | "deny";
};

async function getViewRules(
  companyId: string,
  tenantId: string,
  targetIds: string[],
): Promise<ViewRuleRow[]> {
  if (targetIds.length === 0) return [];

  return db.$queryRawUnsafe<ViewRuleRow[]>(
    `
    SELECT "targetId" AS "targetId", "subjectType" AS "subjectType", "subjectId" AS "subjectId", "effect" AS "effect"
    FROM archive."archive_permissions"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "targetType" = 'folder'
      AND "action" = 'view' AND "revokedAt" IS NULL AND "targetId" = ANY($3::text[])
    `,
    companyId,
    tenantId,
    targetIds,
  );
}

async function getActiveRoleMembers(
  companyId: string,
  tenantId: string,
  roleIds: string[],
): Promise<Map<string, Set<string>>> {
  const members = new Map<string, Set<string>>();
  if (roleIds.length === 0) return members;

  const rows = await db.$queryRawUnsafe<{ roleId: string; platformUserId: string }[]>(
    `
    SELECT "roleId" AS "roleId", "platformUserId" AS "platformUserId"
    FROM archive."archive_role_assignments"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "removedAt" IS NULL AND "roleId" = ANY($3::uuid[])
    `,
    companyId,
    tenantId,
    roleIds,
  );

  for (const row of rows) {
    const set = members.get(row.roleId) ?? new Set<string>();
    set.add(row.platformUserId);
    members.set(row.roleId, set);
  }
  return members;
}

// "Users" = how many distinct platform users effectively hold `view` on this
// folder, resolved the same way the package's own
// ArchiveEffectiveAuthorizationService does (see
// effective-authorization.js#resolveDirectPermissionDecision /
// #hasEffectivePermission): walk the folder's ancestor chain nearest-first,
// at each target a direct user rule decides outright, else a role deny beats
// a role allow, else move outward; the first target that decides wins. Done
// here per-candidate-user instead of per-single-caller since we need a count,
// not one user's yes/no.
export async function getFolderViewerCounts(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (folderIds.length === 0) return counts;

  const chains = await getAncestorChains(companyId, tenantId, folderIds);
  const allTargetIds = [...new Set([...chains.values()].flat())];
  const rules = await getViewRules(companyId, tenantId, allTargetIds);

  const rulesByTarget = new Map<string, ViewRuleRow[]>();
  for (const rule of rules) {
    const list = rulesByTarget.get(rule.targetId) ?? [];
    list.push(rule);
    rulesByTarget.set(rule.targetId, list);
  }

  const roleIds = [...new Set(rules.filter((rule) => rule.subjectType === "role").map((rule) => rule.subjectId))];
  const roleMembers = await getActiveRoleMembers(companyId, tenantId, roleIds);

  function decideAtTarget(targetId: string, userId: string): "allow" | "deny" | "none" {
    const rulesAtTarget = rulesByTarget.get(targetId) ?? [];

    const userRule = rulesAtTarget.find((rule) => rule.subjectType === "user" && rule.subjectId === userId);
    if (userRule) return userRule.effect;

    const roleRulesAtTarget = rulesAtTarget.filter(
      (rule) => rule.subjectType === "role" && roleMembers.get(rule.subjectId)?.has(userId),
    );
    if (roleRulesAtTarget.some((rule) => rule.effect === "deny")) return "deny";
    if (roleRulesAtTarget.some((rule) => rule.effect === "allow")) return "allow";
    return "none";
  }

  for (const folderId of folderIds) {
    const chain = chains.get(folderId) ?? [folderId];

    const candidateUsers = new Set<string>();
    for (const targetId of chain) {
      for (const rule of rulesByTarget.get(targetId) ?? []) {
        if (rule.subjectType === "user") {
          candidateUsers.add(rule.subjectId);
        } else {
          for (const memberId of roleMembers.get(rule.subjectId) ?? []) {
            candidateUsers.add(memberId);
          }
        }
      }
    }

    let allowedCount = 0;
    for (const userId of candidateUsers) {
      for (const targetId of chain) {
        const decision = decideAtTarget(targetId, userId);
        if (decision !== "none") {
          if (decision === "allow") allowedCount += 1;
          break;
        }
      }
    }

    counts.set(folderId, allowedCount);
  }

  return counts;
}
