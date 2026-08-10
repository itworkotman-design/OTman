import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { reviveSectionForFileIfDeleted } from "@/lib/docArchive/contentSections";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fileId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const restoreResult = await archive.restoreFile(ctx, fileId);

  if (!restoreResult.ok) {
    return NextResponse.json(
      { ok: false, reason: restoreResult.error.category, message: restoreResult.error.message },
      { status: archiveErrorStatus(restoreResult.error.category) },
    );
  }

  // Brings the file's original section back if deleting it (not just the
  // file) is what soft-deleted this file — a no-op for the ordinary
  // single-file-delete case, since that never touches the section at all.
  await reviveSectionForFileIfDeleted(ctx.companyId, ctx.tenantId, fileId);

  return NextResponse.json({ ok: true, file: restoreResult.value });
}
