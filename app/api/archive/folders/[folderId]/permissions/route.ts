import { NextResponse } from "next/server";
import type { ArchivePermissionAction, ArchivePermissionEffect, ArchivePermissionSubjectType } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { listEffectiveFolderAccess } from "@/lib/docArchive/folderAccessList";
import { getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";

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
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);

  const [listResult, folderResult] = await Promise.all([
    archive.listPermissionRules(ctx, { targetType: "folder", targetId: folderId }),
    archive.readFolder(ctx, folderId),
  ]);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  // "Who effectively has access" (including via the Admin/Viewer role
  // default, not just rows local to this folder) needs the folder's owner
  // to label ownership correctly — best-effort: a failed readFolder here
  // (shouldn't happen, the caller just proved manage_permissions on this
  // exact folder) degrades to an empty effective-access list rather than
  // failing the whole response, since permissionRules alone is still usable.
  const effectiveAccess = folderResult.ok
    ? await listEffectiveFolderAccess(ctx.companyId, ctx.tenantId, folderId, folderResult.value.ownerUserId)
    : [];

  // The two system roles (see lib/docArchive/tenantRoles.ts) have real
  // local ArchivePermission rows on every root folder — that's how the
  // default cascade works — but they aren't a user-manageable "group" like
  // the rest of this list; they're already surfaced, correctly labeled, in
  // effectiveAccess above ("admin-role"/"viewer-role"). Left in, they'd show
  // up in FolderSharingPanel's generic "Groups with access" list as a raw
  // UUID (they're excluded from /api/archive/roles' name lookup for the
  // same reason), duplicating the "Access via company default" section.
  const systemRoleIds = await getArchiveTenantRoleIds(ctx.companyId);
  const rules = systemRoleIds
    ? listResult.value.filter(
        (rule) =>
          !(rule.subjectType === "role" && (rule.subjectId === systemRoleIds.adminRoleId || rule.subjectId === systemRoleIds.viewerRoleId)),
      )
    : listResult.value;

  return NextResponse.json({ ok: true, rules, effectiveAccess });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";
  const subjectType = parseSubjectType(body);
  const actions = parseActions(body);
  const effect = parseEffect(body);

  if (!subjectId || !actions) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  for (const action of actions) {
    const setResult = await archive.setPermissionRule(ctx, {
      targetType: "folder",
      targetId: folderId,
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
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
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
      targetType: "folder",
      targetId: folderId,
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
