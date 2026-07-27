import { NextResponse } from "next/server";
import type { ArchivePermissionAction, ArchivePermissionSubjectType } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listPermissionRules(ctx, {
    targetType: "folder",
    targetId: folderId,
  });

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, rules: listResult.value });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
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
    const setResult = await archive.setPermissionRule(ctx, {
      targetType: "folder",
      targetId: folderId,
      subjectType,
      subjectId,
      action,
      effect: "allow",
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
  const result = await requireArchiveMembership(req);
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
