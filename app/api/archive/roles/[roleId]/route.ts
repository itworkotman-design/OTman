import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
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
  const deleteResult = await archive.deleteArchiveRole(ctx, { roleId });

  if (!deleteResult.ok) {
    return NextResponse.json(
      { ok: false, reason: deleteResult.error.category, message: deleteResult.error.message },
      { status: archiveErrorStatus(deleteResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, role: deleteResult.value });
}
