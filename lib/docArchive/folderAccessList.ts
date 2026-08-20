import {
  getFolderEffectiveViewers,
  getItemEffectiveViewers,
  type FolderEffectiveViewer,
} from "@/lib/docArchive/folderStats";
import { getArchiveTenantRoleIds, type ArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";

export type FolderAccessSource = "owner" | "admin-role" | "viewer-role" | "direct" | "group";

export type FolderAccessEntry = {
  userId: string;
  source: FolderAccessSource;
  // Decided by a rule directly on THIS target vs. inherited from an
  // ancestor (usually the Admin/Viewer default set on the tree's root, an
  // explicit share set higher up and copied down at creation — see
  // copyParentFolderPermissions in context.ts — or, for an item, its own
  // containing folder).
  local: boolean;
  // For "group": the arbitrary ArchiveRole id whose membership decided
  // (not one of the two system roles) — the caller can resolve its name
  // via /api/archive/roles.
  groupRoleId: string | null;
};

// Shared by listEffectiveFolderAccess and listEffectiveItemAccess below —
// labeling a raw FolderEffectiveViewer list by source is identical for a
// folder or an item target; only how the viewers were computed differs.
function buildAccessEntries(
  viewers: FolderEffectiveViewer[],
  systemRoleIds: ArchiveTenantRoleIds | null,
  targetId: string,
  ownerUserId: string,
): FolderAccessEntry[] {
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

    entries.push({ userId: viewer.userId, source, local: viewer.decidedByTargetId === targetId, groupRoleId });
  }

  // The owner always has full access via grantFolderCreatorCapabilities (or,
  // for an item, direct package auto-grant on create) — include them even
  // in the implausible case no rule currently grants them view, so this
  // list never omits the owner.
  if (!seen.has(ownerUserId)) {
    entries.unshift({ userId: ownerUserId, source: "owner", local: true, groupRoleId: null });
  }

  return entries;
}

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

  return buildAccessEntries(viewers, systemRoleIds, folderId, ownerUserId);
}

// Item-level counterpart to listEffectiveFolderAccess — same idea, but for
// an individual item, so a folder's contents can be shared item-by-item
// without opening up the rest of the folder (see
// app/api/archive/items/[itemId]/permissions/route.ts).
export async function listEffectiveItemAccess(
  companyId: string,
  tenantId: string,
  itemId: string,
  ownerUserId: string,
): Promise<FolderAccessEntry[]> {
  const [viewers, systemRoleIds] = await Promise.all([
    getItemEffectiveViewers(companyId, tenantId, itemId),
    getArchiveTenantRoleIds(companyId),
  ]);

  return buildAccessEntries(viewers, systemRoleIds, itemId, ownerUserId);
}
