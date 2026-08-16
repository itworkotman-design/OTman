import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { deleteSection, renameSection } from "@/lib/docArchive/sections";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const ctx = buildArchiveContext(result.session, result.membership);
  const renameResult = await renameSection(ctx.companyId, ctx.tenantId, sectionId, name, description);

  if (!renameResult.ok) {
    return NextResponse.json({ ok: false, reason: renameResult.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true, section: renameResult.section });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const deleteResult = await deleteSection(ctx.companyId, ctx.tenantId, sectionId);

  if (!deleteResult.ok) {
    const status = deleteResult.reason === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ ok: false, reason: deleteResult.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
