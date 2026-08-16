import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string; tagId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId, tagId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const removeResult = await archive.removeTagFromItem(ctx, itemId, { tagId });

  if (!removeResult.ok) {
    return NextResponse.json(
      { ok: false, reason: removeResult.error.category, message: removeResult.error.message },
      { status: archiveErrorStatus(removeResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true });
}
