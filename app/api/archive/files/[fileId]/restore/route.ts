import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

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

  return NextResponse.json({ ok: true, file: restoreResult.value });
}
