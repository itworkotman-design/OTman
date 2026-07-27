import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const pathResult = await archive.getFolderPath(ctx, folderId);

  if (!pathResult.ok) {
    return NextResponse.json(
      { ok: false, reason: pathResult.error.category, message: pathResult.error.message },
      { status: archiveErrorStatus(pathResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, path: pathResult.value });
}
