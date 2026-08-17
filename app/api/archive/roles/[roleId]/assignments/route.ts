import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext, ensureNamespaceManager } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { roleId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);
  const listResult = await archive.listArchiveRoleAssignmentsForRole(ctx, roleId);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, assignments: listResult.value });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { roleId } = await params;
  const body = await req.json().catch(() => null);
  const platformUserId = typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!platformUserId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);
  const assignResult = await archive.assignArchiveRole(ctx, { roleId, platformUserId });

  if (!assignResult.ok) {
    return NextResponse.json(
      { ok: false, reason: assignResult.error.category, message: assignResult.error.message },
      { status: archiveErrorStatus(assignResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, assignment: assignResult.value }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { roleId } = await params;
  const body = await req.json().catch(() => null);
  const platformUserId = typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!platformUserId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);
  const unassignResult = await archive.unassignArchiveRole(ctx, { roleId, platformUserId });

  if (!unassignResult.ok) {
    return NextResponse.json(
      { ok: false, reason: unassignResult.error.category, message: unassignResult.error.message },
      { status: archiveErrorStatus(unassignResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, assignment: unassignResult.value });
}
