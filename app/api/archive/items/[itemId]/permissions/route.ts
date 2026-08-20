import { NextResponse } from "next/server";
import type { ArchivePermissionAction, ArchivePermissionEffect, ArchivePermissionSubjectType } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { listEffectiveItemAccess } from "@/lib/docArchive/folderAccessList";
import { getArchiveFolderDefaultRoleIds, getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";
import { actionsForArchiveLevel, expandGroupShare, getArchiveLevelForUser } from "@/lib/docArchive/groupShareExpansion";

// Item-level counterpart to app/api/archive/folders/[folderId]/permissions/
// route.ts — same shape, same VALID_ACTIONS/parse helpers, just targeting
// "item" instead of "folder". Lets an owner share (or explicitly deny) one
// item without touching the rest of its containing folder: since an item's
// access is resolved the same nearest-wins way as a folder's (item -> its
// folder -> ... -> root), a direct item-level allow is enough for someone
// to open that one item via readItem/the "Shared with me" id-based route,
// while listChildFolders/listItemsInFolder still gate the folder itself —
// they still can't browse the folder's other contents unless separately
// shared. See lib/docArchive/folderStats.ts's getItemEffectiveViewers/
// getItemAncestorChain for the read side of this.

const VALID_ACTIONS: ArchivePermissionAction[] = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
  "manage_permissions",
];

const VALID_SUBJECT_TYPES: ArchivePermissionSubjectType[] = ["user", "role"];

// An explicit action list is sent by two flows: the DELETE handler below
// (revoking a specific direct/group-derived grant) and the "remove this
// admin from this item's default access" deny flow — the one deliberate
// exception to "access is purely additive" (see the folder-level route's
// header comment for the full rationale). Viewers never get a default to
// deny; a normal grant omits `actions` and lets the server derive it.
function parseActions(body: unknown): ArchivePermissionAction[] | null {
  const raw = (body as { actions?: unknown } | null)?.actions;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (!raw.every((a): a is ArchivePermissionAction => VALID_ACTIONS.includes(a))) return null;
  return raw;
}

function parseSubjectType(body: unknown): ArchivePermissionSubjectType {
  const raw = (body as { subjectType?: unknown } | null)?.subjectType;
  if (typeof raw === "string" && VALID_SUBJECT_TYPES.includes(raw as ArchivePermissionSubjectType)) {
    return raw as ArchivePermissionSubjectType;
  }
  return "user";
}

// Only "allow"/"deny" — "remove" from the Sharing panel is a deny grant
// (see POST below and FolderSharingPanel.tsx), not a distinct verb.
function parseEffect(body: unknown): ArchivePermissionEffect {
  const raw = (body as { effect?: unknown } | null)?.effect;
  return raw === "deny" ? "deny" : "allow";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);

  const [listResult, itemResult] = await Promise.all([
    archive.listPermissionRules(ctx, { targetType: "item", targetId: itemId }),
    archive.readItem(ctx, itemId),
  ]);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  // Best-effort — a failed readItem here (shouldn't happen, the caller just
  // proved manage_permissions on this exact item) degrades to an empty
  // effective-access list rather than failing the whole response, since
  // permissionRules alone is still usable.
  const effectiveAccess = itemResult.ok
    ? await listEffectiveItemAccess(ctx.companyId, ctx.tenantId, itemId, itemResult.value.ownerUserId)
    : [];

  // Same system-role filtering as the folder route — the two durable
  // Admin/Viewer roles and every folder's own dedicated default-access role
  // aren't a user-manageable "group", they're already surfaced (correctly
  // labeled) in effectiveAccess.
  const [systemRoleIds, folderDefaultRoleIds] = await Promise.all([
    getArchiveTenantRoleIds(ctx.companyId),
    getArchiveFolderDefaultRoleIds(ctx.companyId),
  ]);
  const rules = listResult.value.filter(
    (rule) =>
      !(
        rule.subjectType === "role" &&
        ((systemRoleIds && (rule.subjectId === systemRoleIds.adminRoleId || rule.subjectId === systemRoleIds.viewerRoleId)) ||
          folderDefaultRoleIds.has(rule.subjectId))
      ),
  );

  return NextResponse.json({ ok: true, rules, effectiveAccess });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";
  const subjectType = parseSubjectType(body);
  const explicitActions = parseActions(body);
  const alsoManageSharing = body?.alsoManageSharing === true;
  // Deny only applies to an individual user — a group share stays purely
  // additive regardless of what the caller sends (see the folder route).
  const effect: ArchivePermissionEffect = subjectType === "user" ? parseEffect(body) : "allow";

  if (!subjectId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  // A group fans out into a direct per-member grant each, with the action
  // bundle derived from each member's own current Archive role — see
  // lib/docArchive/groupShareExpansion.ts.
  if (!explicitActions && subjectType === "role") {
    try {
      const { adminCount, viewerCount } = await expandGroupShare(ctx, subjectId, "item", itemId, alsoManageSharing);
      return NextResponse.json({ ok: true, adminCount, viewerCount });
    } catch (error) {
      return NextResponse.json(
        { ok: false, reason: "GROUP_SHARE_FAILED", message: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  // A plain user grant with no explicit actions: derive the bundle from
  // their own current Archive role.
  const actions = explicitActions ?? actionsForArchiveLevel(await getArchiveLevelForUser(ctx.companyId, subjectId), alsoManageSharing);

  for (const action of actions) {
    const setResult = await archive.setPermissionRule(ctx, {
      targetType: "item",
      targetId: itemId,
      subjectType,
      subjectId,
      action,
      effect,
    });

    if (!setResult.ok) {
      return NextResponse.json(
        { ok: false, reason: setResult.error.category, message: setResult.error.message },
        { status: archiveErrorStatus(setResult.error.category) },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";
  const subjectType = parseSubjectType(body);
  const actions = parseActions(body);

  if (!subjectId || !actions) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  for (const action of actions) {
    const revokeResult = await archive.revokePermissionRule(ctx, {
      targetType: "item",
      targetId: itemId,
      subjectType,
      subjectId,
      action,
    });

    if (!revokeResult.ok) {
      return NextResponse.json(
        { ok: false, reason: revokeResult.error.category, message: revokeResult.error.message },
        { status: archiveErrorStatus(revokeResult.error.category) },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
