import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { moveItemToSection } from "@/lib/docArchive/sections";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";

  if (!sectionId) {
    return NextResponse.json({ ok: false, reason: "SECTION_REQUIRED" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const readResult = await archive.readItem(ctx, itemId);

  if (!readResult.ok) {
    return NextResponse.json(
      { ok: false, reason: readResult.error.category, message: readResult.error.message },
      { status: archiveErrorStatus(readResult.error.category) },
    );
  }

  const moveResult = await moveItemToSection(
    ctx.companyId,
    ctx.tenantId,
    itemId,
    readResult.value.folderId,
    sectionId,
  );

  if (!moveResult.ok) {
    return NextResponse.json({ ok: false, reason: moveResult.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
