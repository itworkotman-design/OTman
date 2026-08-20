import { NextResponse } from "next/server";
import type { ArchivePermissionAction, ArchivePermissionEffect, ArchivePermissionSubjectType } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { listEffectiveFolderAccess } from "@/lib/docArchive/folderAccessList";
import { getArchiveFolderDefaultRoleIds, getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";
import { actionsForArchiveLevel, expandGroupShare, getArchiveLevelForUser } from "@/lib/docArchive/groupShareExpansion";

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
// admin from this folder's default access" deny flow (see
// FolderSettingsView.tsx's DEFAULT_ACCESS_DENY_ACTIONS) — the latter is the
// one deliberate exception to "access is purely additive": an owner can
// deny a specific company Admin on their folder even though that Admin's
// access comes from the role default, not a row of their own. Viewers never
// get a default to deny in the first place (see
// grantDefaultRoleAccessOnRootFolder in context.ts) — they're only ever
// added, and "remove" for them is always a real revoke (DELETE) of their
// direct/group-derived row. A normal grant omits `actions` entirely and
// lets the server derive it from the subject's own current Archive role —
// see the POST handler below.
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

// Only "allow"/"deny". Deny is deliberately narrow — see parseActions above
// — the caller (FolderSettingsView.tsx) only ever sends it for the
// "remove this admin from my folder" flow, always paired with
// subjectType: "user" and explicit actions; a normal share never sends it.
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

  // The system roles — the two company-wide ones (see
  // lib/docArchive/tenantRoles.ts) plus every folder's own dedicated
  // default-access role (see ArchiveFolderDefaultRole) — have real local
  // ArchivePermission rows on root folders; that's how the default cascade
  // works. None of them are a user-manageable "group" like the rest of this
  // list; they're already surfaced, correctly labeled, in effectiveAccess
  // above ("admin-role"/"viewer-role"). Left in, they'd show up in
  // FolderSharingPanel's generic "Groups with access" list as a raw UUID
  // (they're excluded from /api/archive/roles' name lookup for the same
  // reason), duplicating the "Access via company default" section.
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
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";
  const subjectType = parseSubjectType(body);
  const explicitActions = parseActions(body);
  const alsoManageSharing = body?.alsoManageSharing === true;
  // Deny is only ever valid for an individual user (removing them from the
  // Admin default on this folder) — a group share stays purely additive
  // regardless of what the caller sends, so a malformed/unexpected
  // subjectType: "role" + effect: "deny" combination silently degrades to
  // "allow" rather than denying an entire group.
  const effect: ArchivePermissionEffect = subjectType === "user" ? parseEffect(body) : "allow";

  if (!subjectId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  // A group (arbitrary ArchiveRole) fans out into a direct per-member grant
  // each, with the action bundle derived from each member's own current
  // Archive role — see lib/docArchive/groupShareExpansion.ts's header
  // comment for why one role-level row can't do this for a mixed group.
  if (!explicitActions && subjectType === "role") {
    try {
      const { adminCount, viewerCount } = await expandGroupShare(ctx, subjectId, "folder", folderId, alsoManageSharing);
      return NextResponse.json({ ok: true, adminCount, viewerCount });
    } catch (error) {
      return NextResponse.json(
        { ok: false, reason: "GROUP_SHARE_FAILED", message: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  // A plain user grant with no explicit actions: derive the bundle from
  // their own current Archive role, same as the group fan-out above does
  // per member — capability is never picked ad hoc per share.
  const actions = explicitActions ?? actionsForArchiveLevel(await getArchiveLevelForUser(ctx.companyId, subjectId), alsoManageSharing);

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
