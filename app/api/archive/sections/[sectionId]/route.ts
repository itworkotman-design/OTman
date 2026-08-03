import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { deleteSection } from "@/lib/docArchive/sections";

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
