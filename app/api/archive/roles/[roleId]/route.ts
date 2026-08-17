import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext, ensureNamespaceManager } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { roleId } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);
  const renameResult = await archive.renameArchiveRole(ctx, { roleId, name });

  if (!renameResult.ok) {
    return NextResponse.json(
      { ok: false, reason: renameResult.error.category, message: renameResult.error.message },
      { status: archiveErrorStatus(renameResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, role: renameResult.value });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { roleId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);

  // A role assigned to coworkers is in use — deleting it would silently
  // un-share every folder shared with it. Enforced here (not just in the
  // User Management UI) so a direct API call can't bypass the guard. This is
  // still a check-then-act race against a concurrent assignment, not an
  // atomic DB constraint — deleteArchiveRole itself (vendored from
  // @customprojects/custom-archive) has no "reject if in use" mode, only an
  // unconditional cascade.
  const assignmentsResult = await archive.listArchiveRoleAssignmentsForRole(ctx, roleId);

  if (!assignmentsResult.ok) {
    return NextResponse.json(
      { ok: false, reason: assignmentsResult.error.category, message: assignmentsResult.error.message },
      { status: archiveErrorStatus(assignmentsResult.error.category) },
    );
  }

  if (assignmentsResult.value.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "ROLE_IN_USE",
        message: `This role is assigned to ${assignmentsResult.value.length} member${assignmentsResult.value.length === 1 ? "" : "s"} and can't be deleted. Remove them first.`,
      },
      { status: 409 },
    );
  }

  const deleteResult = await archive.deleteArchiveRole(ctx, { roleId });

  if (!deleteResult.ok) {
    return NextResponse.json(
      { ok: false, reason: deleteResult.error.category, message: deleteResult.error.message },
      { status: archiveErrorStatus(deleteResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, role: deleteResult.value });
}
