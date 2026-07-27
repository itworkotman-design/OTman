import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listRecoverableFilesForItem(ctx, itemId);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, files: listResult.value });
}
