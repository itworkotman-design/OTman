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

export type AncestorChain = {
  // Nearest-first (folder itself first, root last).
  chain: string[];
  // Mirrors the package's own resolveAuthorizationChain (mode "normal",
  // effective-authorization.js): the WHOLE chain is invalid the instant any
  // node from the target to the root is soft-deleted, or the walk never
  // reaches a true root (a missing ancestor) — not merely truncated at that
  // point. An earlier version of this query filtered `deletedAt IS NULL`
  // inside the recursive CTE itself, which silently stopped the walk at the
  // first deleted ancestor instead of invalidating the chain; that let a
  // nearer target's rule decide access the package would have denied
  // outright (proven divergence: folder with its own `allow`, a
  // soft-deleted parent, nothing above — package denies, the old query here
  // allowed). Callers MUST check `valid` before evaluating any rule.
  valid: boolean;
};

// Ancestor chain per requested folder id — shared with
// lib/docArchive/folderCodes.ts (which only needs `.chain`, in root-first
// order, to build display codes and doesn't care about `valid`: a code is
// rendered for a folder regardless of whether it's currently accessible).
export async function getAncestorChains(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, AncestorChain>> {
  const chains = new Map<string, AncestorChain>();
  if (folderIds.length === 0) return chains;

  const rows = await db.$queryRawUnsafe<
    { rootId: string; ancestorId: string; parentFolderId: string | null; deletedAt: string | null }[]
  >(
    `
    WITH RECURSIVE chain AS (
      SELECT "id" AS "rootId", "id" AS "ancestorId", "parentFolderId", "deletedAt", 0 AS depth
      FROM archive."archive_folders"
      WHERE "companyId" = $1 AND "tenantId" = $2 AND "id" = ANY($3::uuid[])
      UNION ALL
      SELECT c."rootId", f."id", f."parentFolderId", f."deletedAt", c.depth + 1
      FROM archive."archive_folders" f
      JOIN chain c ON f."id" = c."parentFolderId"
      WHERE f."companyId" = $1 AND f."tenantId" = $2
    )
    SELECT "rootId" AS "rootId", "ancestorId" AS "ancestorId", "parentFolderId" AS "parentFolderId", "deletedAt" AS "deletedAt"
    FROM chain ORDER BY "rootId", depth ASC
    `,
    companyId,
    tenantId,
    folderIds,
  );

  const rowsByRoot = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = rowsByRoot.get(row.rootId) ?? [];
    list.push(row);
    rowsByRoot.set(row.rootId, list);
  }

  for (const [rootId, chainRows] of rowsByRoot) {
    const chain = chainRows.map((row) => row.ancestorId);
    const anyDeleted = chainRows.some((row) => row.deletedAt !== null);
    const reachedRoot = chainRows[chainRows.length - 1]?.parentFolderId === null;
    chains.set(rootId, { chain, valid: !anyDeleted && reachedRoot });
  }
  return chains;
}

type ViewRuleRow = {
  targetId: string;
  subjectType: "user" | "role";
  subjectId: string;
  effect: "allow" | "deny";
};

// Not filtered by targetType — chain target ids are unique uuids regardless
// of whether they name a folder or an item (see getItemAncestorChain), so a
// single query correctly covers both a folder-only chain and a chain that
// starts with an item.
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
    WHERE "companyId" = $1 AND "tenantId" = $2
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
  const allTargetIds = [...new Set([...chains.values()].flatMap((c) => c.chain))];
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
    const resolvedChain = chains.get(folderId);
    // An invalid (or entirely missing/unknown) chain denies outright,
    // matching hasEffectivePermission's "!chain.valid -> false" — a nearer
    // target's allow never gets a chance to decide.
    if (!resolvedChain || !resolvedChain.valid) continue;
    const chain = resolvedChain.chain;

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

// The single-user inverse of getFolderViewerCounts, for callers that read
// broadly across the tree (searchArchiveTree.ts's recursive search has no
// permission filtering of its own — the SQL just walks the folder tree) and
// need to drop candidates the caller can't actually view before returning
// them. Same chain-walk decision rule as above and as the package's own
// ArchiveEffectiveAuthorizationService, just resolved for one userId across
// many folderIds in one batch instead of many users against one folder.
export async function getViewableFolderIds(
  companyId: string,
  tenantId: string,
  userId: string,
  folderIds: string[],
): Promise<Set<string>> {
  const viewable = new Set<string>();
  if (folderIds.length === 0) return viewable;

  const chains = await getAncestorChains(companyId, tenantId, folderIds);
  const allTargetIds = [...new Set([...chains.values()].flatMap((c) => c.chain))];
  const rules = await getViewRules(companyId, tenantId, allTargetIds);

  const rulesByTarget = new Map<string, ViewRuleRow[]>();
  for (const rule of rules) {
    const list = rulesByTarget.get(rule.targetId) ?? [];
    list.push(rule);
    rulesByTarget.set(rule.targetId, list);
  }

  const roleIds = [...new Set(rules.filter((rule) => rule.subjectType === "role").map((rule) => rule.subjectId))];
  const roleMembers = await getActiveRoleMembers(companyId, tenantId, roleIds);

  function decideAtTarget(targetId: string): "allow" | "deny" | "none" {
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
    const resolvedChain = chains.get(folderId);
    // Same "!valid -> deny outright" rule as getFolderViewerCounts above —
    // see AncestorChain's doc comment.
    if (!resolvedChain || !resolvedChain.valid) continue;

    for (const targetId of resolvedChain.chain) {
      const decision = decideAtTarget(targetId);
      if (decision !== "none") {
        if (decision === "allow") viewable.add(folderId);
        break;
      }
    }
  }

  return viewable;
}

export type FolderEffectiveViewer = {
  userId: string;
  // Which target in the chain (the folder/item itself, or an ancestor) made
  // the decision — lets a caller tell "local to this target" from
  // "inherited".
  decidedByTargetId: string;
  decidedBySubjectType: "user" | "role";
  // The direct-user id, or the role id, whose rule actually decided.
  decidedBySubjectId: string;
};

// Shared by getFolderEffectiveViewers and getItemEffectiveViewers below —
// everything past "I already have a valid chain" is identical for a folder
// target and an item target (an item's chain is just its own id prepended
// to its containing folder's chain — see getItemAncestorChain).
async function getEffectiveViewersForChain(
  companyId: string,
  tenantId: string,
  chain: string[],
): Promise<FolderEffectiveViewer[]> {
  const rules = await getViewRules(companyId, tenantId, chain);

  const rulesByTarget = new Map<string, ViewRuleRow[]>();
  for (const rule of rules) {
    const list = rulesByTarget.get(rule.targetId) ?? [];
    list.push(rule);
    rulesByTarget.set(rule.targetId, list);
  }

  const roleIds = [...new Set(rules.filter((rule) => rule.subjectType === "role").map((rule) => rule.subjectId))];
  const roleMembers = await getActiveRoleMembers(companyId, tenantId, roleIds);

  const candidateUsers = new Set<string>();
  for (const rule of rules) {
    if (rule.subjectType === "user") {
      candidateUsers.add(rule.subjectId);
    } else {
      for (const memberId of roleMembers.get(rule.subjectId) ?? []) {
        candidateUsers.add(memberId);
      }
    }
  }

  const viewers: FolderEffectiveViewer[] = [];

  for (const userId of candidateUsers) {
    for (const targetId of chain) {
      const rulesAtTarget = rulesByTarget.get(targetId) ?? [];
      const userRule = rulesAtTarget.find((rule) => rule.subjectType === "user" && rule.subjectId === userId);

      if (userRule) {
        if (userRule.effect === "allow") {
          viewers.push({ userId, decidedByTargetId: targetId, decidedBySubjectType: "user", decidedBySubjectId: userId });
        }
        break;
      }

      const roleRulesAtTarget = rulesAtTarget.filter(
        (rule) => rule.subjectType === "role" && roleMembers.get(rule.subjectId)?.has(userId),
      );
      const denyRole = roleRulesAtTarget.find((rule) => rule.effect === "deny");
      if (denyRole) break;

      const allowRole = roleRulesAtTarget.find((rule) => rule.effect === "allow");
      if (allowRole) {
        viewers.push({
          userId,
          decidedByTargetId: targetId,
          decidedBySubjectType: "role",
          decidedBySubjectId: allowRole.subjectId,
        });
        break;
      }
      // No decision at this target — continue outward.
    }
  }

  return viewers;
}

// Every platform user who effectively holds `view` on this one folder, with
// which rule decided it — lib/docArchive/folderAccessList.ts's "who
// currently has access" list (surfaced in FolderSharingPanel.tsx) needs not
// just a count (getFolderViewerCounts above) but WHO and via WHAT, so
// "remove" can target the right subject. Same chain-walk/decision rule as
// getFolderViewerCounts, just for one folder and returning the decision
// instead of only counting it.
export async function getFolderEffectiveViewers(
  companyId: string,
  tenantId: string,
  folderId: string,
): Promise<FolderEffectiveViewer[]> {
  const chains = await getAncestorChains(companyId, tenantId, [folderId]);
  const resolvedChain = chains.get(folderId);
  if (!resolvedChain || !resolvedChain.valid) return [];

  return getEffectiveViewersForChain(companyId, tenantId, resolvedChain.chain);
}

// An item's own chain, nearest-first: the item itself, then its containing
// folder's own ancestor chain. Mirrors AncestorChain's contract (see
// getAncestorChains) — `valid` is false if the item itself is missing/
// deleted, or if its containing folder's own chain is invalid.
export async function getItemAncestorChain(
  companyId: string,
  tenantId: string,
  itemId: string,
): Promise<AncestorChain | null> {
  const itemRows = await db.$queryRawUnsafe<{ id: string; folderId: string; deletedAt: string | null }[]>(
    `SELECT "id" AS "id", "folderId" AS "folderId", "deletedAt" AS "deletedAt" FROM archive."archive_items" WHERE "companyId" = $1 AND "tenantId" = $2 AND "id" = $3`,
    companyId,
    tenantId,
    itemId,
  );
  const item = itemRows[0];
  if (!item) return null;

  const folderChains = await getAncestorChains(companyId, tenantId, [item.folderId]);
  const folderChain = folderChains.get(item.folderId);
  if (!folderChain) return { chain: [itemId], valid: false };

  return {
    chain: [itemId, ...folderChain.chain],
    valid: folderChain.valid && item.deletedAt === null,
  };
}

// The item-level counterpart to getFolderEffectiveViewers — same "who has
// view, and via what rule" computation, starting from an item's own chain
// instead of a folder's.
export async function getItemEffectiveViewers(
  companyId: string,
  tenantId: string,
  itemId: string,
): Promise<FolderEffectiveViewer[]> {
  const resolvedChain = await getItemAncestorChain(companyId, tenantId, itemId);
  if (!resolvedChain || !resolvedChain.valid) return [];

  return getEffectiveViewersForChain(companyId, tenantId, resolvedChain.chain);
}
