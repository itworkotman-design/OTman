import { getFolderEffectiveViewers } from "@/lib/docArchive/folderStats";
import { getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";

export type FolderAccessSource = "owner" | "admin-role" | "viewer-role" | "direct" | "group";

export type FolderAccessEntry = {
  userId: string;
  source: FolderAccessSource;
  // Decided by a rule directly on THIS folder vs. inherited from an
  // ancestor (usually the Admin/Viewer default set on the tree's root, or
  // an explicit share set higher up and copied down at creation — see
  // copyParentFolderPermissions in context.ts).
  local: boolean;
  // For "group": the arbitrary ArchiveRole id whose membership decided
  // (not one of the two system roles) — the caller can resolve its name
  // via /api/archive/roles.
  groupRoleId: string | null;
};

// Who currently has effective view access to a folder, labeled by how they
// got it, for FolderSharingPanel.tsx's "who has access" list — the
// counterpart to "grant access" that lets an owner remove a specific
// person regardless of whether their access came from the Admin/Viewer
// role default, an inherited share, or a direct local grant (see the
// permissions route's POST with effect="deny").
export async function listEffectiveFolderAccess(
  companyId: string,
  tenantId: string,
  folderId: string,
  ownerUserId: string,
): Promise<FolderAccessEntry[]> {
  const [viewers, systemRoleIds] = await Promise.all([
    getFolderEffectiveViewers(companyId, tenantId, folderId),
    getArchiveTenantRoleIds(companyId),
  ]);

  const entries: FolderAccessEntry[] = [];
  const seen = new Set<string>();

  for (const viewer of viewers) {
    if (seen.has(viewer.userId)) continue;
    seen.add(viewer.userId);

    let source: FolderAccessSource;
    let groupRoleId: string | null = null;

    if (viewer.userId === ownerUserId) {
      source = "owner";
    } else if (viewer.decidedBySubjectType === "user") {
      source = "direct";
    } else if (systemRoleIds && viewer.decidedBySubjectId === systemRoleIds.adminRoleId) {
      source = "admin-role";
    } else if (systemRoleIds && viewer.decidedBySubjectId === systemRoleIds.viewerRoleId) {
      source = "viewer-role";
    } else {
      source = "group";
      groupRoleId = viewer.decidedBySubjectId;
    }

    entries.push({ userId: viewer.userId, source, local: viewer.decidedByTargetId === folderId, groupRoleId });
  }

  // The owner always has full access via grantFolderCreatorCapabilities at
  // creation — include them even in the implausible case no rule currently
  // grants them view, so this list never omits the folder's owner.
  if (!seen.has(ownerUserId)) {
    entries.unshift({ userId: ownerUserId, source: "owner", local: true, groupRoleId: null });
  }

  return entries;
}
