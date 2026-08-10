import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { discardUnsavedFile } from "@/lib/docArchive/discardUnsavedFile";

// Hard-deletes a file that was uploaded moments ago as part of an item
// Save that the user then cancelled before it finished — see
// ContentSectionList's upload-progress modal and discardUnsavedFile.ts for
// why this can't just be the normal soft-delete route. Never touches a file
// that's already gone through the normal delete lifecycle.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string; fileId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId, fileId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);

  const discardResult = await discardUnsavedFile(ctx.companyId, ctx.tenantId, itemId, fileId);

  if (!discardResult.ok) {
    const status = discardResult.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: discardResult.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
