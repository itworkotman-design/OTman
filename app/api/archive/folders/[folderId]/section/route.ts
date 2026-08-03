import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { moveFolderToSection } from "@/lib/docArchive/sections";

// Re-assigns which section this folder belongs to within its own parent
// scope (root or a containing folder) — the "move to section" action, both
// for reorganizing and for sorting pre-existing, still-ungrouped folders
// (created before this feature existed, so their ArchiveFolderCode.sectionId
// is null) into a real section.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";

  if (!sectionId) {
    return NextResponse.json({ ok: false, reason: "SECTION_REQUIRED" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const readResult = await archive.readFolder(ctx, folderId);

  if (!readResult.ok) {
    return NextResponse.json(
      { ok: false, reason: readResult.error.category, message: readResult.error.message },
      { status: archiveErrorStatus(readResult.error.category) },
    );
  }

  const moveResult = await moveFolderToSection(
    ctx.companyId,
    ctx.tenantId,
    folderId,
    readResult.value.parentFolderId,
    sectionId,
  );

  if (!moveResult.ok) {
    return NextResponse.json({ ok: false, reason: moveResult.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
