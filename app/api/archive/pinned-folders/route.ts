import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { withFolderStats } from "@/lib/docArchive/withFolderStats";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listPinnedFolders(ctx);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  const folders = await withFolderStats(ctx, listResult.value);

  return NextResponse.json({ ok: true, folders });
}
