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
  const listResult = await archive.listChildFolders(ctx, folderId);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, folders: listResult.value });
}
