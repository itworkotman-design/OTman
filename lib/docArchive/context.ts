import type { ArchiveContextInput, ArchivePermissionAction } from "@customprojects/custom-archive";
import type { AuthenticatedSession } from "@/lib/auth/session";
import type { ActiveMembership } from "@/lib/auth/membership";
import { canAccessArchive, hasFullAccess } from "@/lib/users/access";
import { archive, archivePrisma } from "@/lib/docArchive/client";

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
