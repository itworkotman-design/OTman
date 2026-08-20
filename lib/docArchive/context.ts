import type {
  ArchiveContextInput,
  ArchivePermissionAction,
  ArchivePermissionEffect,
  ArchivePermissionSubjectType,
} from "@customprojects/custom-archive";
import type { AuthenticatedSession } from "@/lib/auth/session";
import type { ActiveMembership } from "@/lib/auth/membership";
import { canAccessArchive, hasFullAccess } from "@/lib/users/access";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { ensureArchiveTenantRoles } from "@/lib/docArchive/tenantRoles";

export function buildArchiveContext(
  session: AuthenticatedSession,
  membership: ActiveMembership,
): ArchiveContextInput {
  return {
    userId: session.userId,
    companyId: membership.companyId,
    tenantId: membership.companyId,
    archiveModuleAccess: canAccessArchive(membership.role, membership.permissions),
  };
}

// bootstrapNamespacePermissions is a system operation Archive does not gate itself
// (see INTEGRATION.md #9) — the host must restrict it. Only a company's full-access
// members (OWNER/ADMIN) may bootstrap their own tenant's namespace, and only once:
// the call is a validation no-op once a manager already exists, so it's safe to
// attempt lazily on first root-folder creation instead of a separate admin step.
export async function ensureNamespaceBootstrapped(
  ctx: ArchiveContextInput,
  actorRole: ActiveMembership["role"],
): Promise<void> {
  if (!hasFullAccess(actorRole) || !ctx.archiveModuleAccess) return;

  const result = await archive.bootstrapNamespacePermissions(ctx, {
    targetUserId: ctx.userId,
  });

  if (!result.ok && result.error.category !== "validation") {
    throw new Error(
      `Failed to bootstrap Archive namespace: ${result.error.message}`,
    );
  }
}

// `bootstrapNamespacePermissions` is a validation no-op the moment ANY
// namespace manager already exists for the tenant (docs: "valid only while
// the tenant has zero active namespace manage_permissions=allow rules") — so
// it only ever provisions the very first OWNER/ADMIN to touch Archive. Every
// full-access member after that has zero namespace permissions of their own
// (a company Role/app-access grant is not an Archive-namespace grant), so
// namespace-gated methods like `listArchiveRoles` return `not_found` for
// them even though they're a legitimate company Admin with Archive access.
// This self-heals that: every full-access + Archive-enabled caller becomes a
// namespace manager on their own first Roles-surface request, not just
// whoever happened to get there first. `archivePrisma` is typed narrowly
// (see folderStats.ts's comment on the same pattern) but is a real Prisma
// client at runtime, so the direct insert against the archive-owned
// permissions table works; `ON CONFLICT DO NOTHING` makes it safe against the
// package's own one-active-rule partial unique index without a separate
// existence check.
type ArchivePermissionWriteClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

const permissionDb = archivePrisma as unknown as ArchivePermissionWriteClient;

export async function ensureNamespaceManager(
  ctx: ArchiveContextInput,
  actorRole: ActiveMembership["role"],
): Promise<void> {
  if (!hasFullAccess(actorRole) || !ctx.archiveModuleAccess) return;

  await ensureNamespaceBootstrapped(ctx, actorRole);

  await permissionDb.$queryRawUnsafe(
    `
    INSERT INTO archive."archive_permissions"
      ("id", "companyId", "tenantId", "targetType", "targetId", "subjectType", "subjectId", "action", "effect", "grantedByUserId")
    VALUES (gen_random_uuid(), $1, $2, 'namespace', $2, 'user', $3, 'manage_permissions', 'allow', $3)
    ON CONFLICT DO NOTHING
    `,
    ctx.companyId,
    ctx.tenantId,
    ctx.userId,
  );
}

// createFolder only auto-grants the creator `view` + `manage_permissions` on
// the new folder (confirmed via getEffectiveCapabilities against a real
// folder — not documented explicitly in API.md). Without this, a folder is
// unusable the moment it's created: the creator can see it and manage its
// permissions, but can't add items/files to it. manage_permissions is enough
// to self-grant the rest, so seed it right after creation.
const FOLDER_CREATOR_GRANTED_ACTIONS: ArchivePermissionAction[] = [
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
];

export async function grantFolderCreatorCapabilities(
  ctx: ArchiveContextInput,
  folderId: string,
): Promise<void> {
  for (const action of FOLDER_CREATOR_GRANTED_ACTIONS) {
    const result = await archive.setPermissionRule(ctx, {
      targetType: "folder",
      targetId: folderId,
      subjectType: "user",
      subjectId: ctx.userId,
      action,
      effect: "allow",
    });

    if (!result.ok) {
      throw new Error(
        `Failed to grant folder creator "${action}" capability: ${result.error.message}`,
      );
    }
  }
}

// Everything the Admin role gets by default on a root folder — deliberately
// NOT manage_permissions, so only the folder's owner (or someone they
// explicitly co-share full access with) can change who's allowed on it. If
// Admin also got manage_permissions here, any company admin could undo
// another admin's per-folder override, and "the owner decides" wouldn't
// actually be true.
const ADMIN_DEFAULT_ROLE_ACTIONS: ArchivePermissionAction[] = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
];

// Grants the tenant's two durable roles (see lib/docArchive/tenantRoles.ts)
// default access on a newly created ROOT folder: Admin -> allow the bundle
// above, Viewer -> allow view. Subfolders need no grant of their own to
// inherit this — the package's nearest-wins ancestor-chain resolver falls
// through to whatever rule an ancestor has when a descendant has none of
// its own (verified against effective-authorization.js), so these two rows
// cascade to the whole tree beneath this folder automatically. A folder
// owner overrides per-folder by adding a local deny for a specific person
// through the Sharing panel (see FolderSharingPanel.tsx) — there is no
// separate "restricted" flag; removal IS the override.
export async function grantDefaultRoleAccessOnRootFolder(
  ctx: ArchiveContextInput,
  rootFolderId: string,
): Promise<void> {
  const { adminRoleId, viewerRoleId } = await ensureArchiveTenantRoles(ctx);

  for (const action of ADMIN_DEFAULT_ROLE_ACTIONS) {
    const result = await archive.setPermissionRule(ctx, {
      targetType: "folder",
      targetId: rootFolderId,
      subjectType: "role",
      subjectId: adminRoleId,
      action,
      effect: "allow",
    });

    if (!result.ok) {
      throw new Error(
        `Failed to grant Admin role "${action}" on root folder: ${result.error.message}`,
      );
    }
  }

  const viewerResult = await archive.setPermissionRule(ctx, {
    targetType: "folder",
    targetId: rootFolderId,
    subjectType: "role",
    subjectId: viewerRoleId,
    action: "view",
    effect: "allow",
  });

  if (!viewerResult.ok) {
    throw new Error(
      `Failed to grant Viewer role view on root folder: ${viewerResult.error.message}`,
    );
  }
}

type ArchivePermissionRow = {
  subjectType: ArchivePermissionSubjectType;
  subjectId: string;
  action: ArchivePermissionAction;
  effect: ArchivePermissionEffect;
};

// Snapshot-copies a folder's current explicit permission rules onto a newly
// created subfolder, so the subfolder starts with a real, visible,
// independently-editable ACL matching its parent — instead of relying purely
// on the package's implicit "no rule of my own falls through to my parent"
// resolution, which already grants the same *effective* access dynamically
// but leaves nothing for the new folder's own Sharing UI to show, and would
// silently change if the parent's permissions are edited later. This is a
// deliberate one-time copy at creation, not an ongoing sync, so each
// folder's grants stay independently adjustable afterward.
//
// Reads the parent's rows via a direct query rather than the package's own
// listPermissionRules, which additionally requires manage_permissions on the
// parent — createFolder itself only requires `create` on the parent, so a
// legitimate subfolder-creator isn't guaranteed to clear that stricter bar
// (e.g. a restricted folder's explicit viewer who was also granted create).
export async function copyParentFolderPermissions(
  ctx: ArchiveContextInput,
  parentFolderId: string,
  newFolderId: string,
): Promise<void> {
  const rows = await permissionDb.$queryRawUnsafe<ArchivePermissionRow[]>(
    `
    SELECT "subjectType" AS "subjectType", "subjectId" AS "subjectId", "action" AS "action", "effect" AS "effect"
    FROM archive."archive_permissions"
    WHERE "companyId" = $1 AND "tenantId" = $2 AND "targetType" = 'folder'
      AND "targetId" = $3 AND "revokedAt" IS NULL
    `,
    ctx.companyId,
    ctx.tenantId,
    parentFolderId,
  );

  for (const row of rows) {
    const result = await archive.setPermissionRule(ctx, {
      targetType: "folder",
      targetId: newFolderId,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      action: row.action,
      effect: row.effect,
    });

    if (!result.ok) {
      throw new Error(
        `Failed to copy parent folder permission "${row.action}" for subject "${row.subjectId}": ${result.error.message}`,
      );
    }
  }
}
