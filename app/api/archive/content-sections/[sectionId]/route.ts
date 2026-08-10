import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { deleteContentSection, listFileIdsForSection } from "@/lib/docArchive/contentSections";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);

  // Soft-delete every file this section holds BEFORE the section itself is
  // deleted — deleteContentSection cascades away the ArchiveItemFileSection
  // link rows that name which files belonged to it, so this list has to be
  // read first. Best-effort: a single file's soft-delete failing (e.g.
  // already gone) doesn't block deleting the section.
  const fileIds = await listFileIdsForSection(ctx.companyId, ctx.tenantId, sectionId);
  await Promise.all(fileIds.map((fileId) => archive.softDeleteFile(ctx, fileId)));

  const deleteResult = await deleteContentSection(ctx.companyId, ctx.tenantId, sectionId);

  if (!deleteResult.ok) {
    return NextResponse.json({ ok: false, reason: deleteResult.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
