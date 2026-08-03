import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fileId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const deleteResult = await archive.softDeleteFile(ctx, fileId);

  if (!deleteResult.ok) {
    return NextResponse.json(
      { ok: false, reason: deleteResult.error.category, message: deleteResult.error.message },
      { status: archiveErrorStatus(deleteResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, file: deleteResult.value });
}
