import type { ArchiveContextInput } from "@customprojects/custom-archive";
import type { AuthenticatedSession } from "@/lib/auth/session";
import type { ActiveMembership } from "@/lib/auth/membership";
import { canAccessArchive, hasFullAccess } from "@/lib/users/access";
import { archive } from "@/lib/docArchive/client";

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
