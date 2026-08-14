import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { moveFolderToFolder } from "@/lib/docArchive/moveFolder";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  // Moving to the archive root is deliberately unsupported (see
  // moveFolder.ts's file-top comment) — parentFolderId is required here,
  // not the nullable-for-root shape an earlier pass used.
  const parentFolderId = typeof body?.parentFolderId === "string" ? body.parentFolderId.trim() : "";
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";

  if (!parentFolderId) {
    return NextResponse.json({ ok: false, reason: "FOLDER_REQUIRED" }, { status: 400 });
  }
  if (!sectionId) {
    return NextResponse.json({ ok: false, reason: "SECTION_REQUIRED" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const moveResult = await moveFolderToFolder(ctx, folderId, parentFolderId, sectionId);

  if (!moveResult.ok) {
    const status =
      moveResult.reason === "SAME_FOLDER" || moveResult.reason === "CYCLE" || moveResult.reason === "INVALID_SECTION"
        ? 400
        : 404;
    return NextResponse.json({ ok: false, reason: moveResult.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
