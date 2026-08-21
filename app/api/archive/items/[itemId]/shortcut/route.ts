import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { createItemShortcut } from "@/lib/docArchive/shortcuts";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const folderId = typeof body?.folderId === "string" ? body.folderId.trim() : "";
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() || null : null;

  if (!folderId) {
    return NextResponse.json({ ok: false, reason: "FOLDER_REQUIRED" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const createResult = await createItemShortcut(ctx, itemId, folderId, sectionId);

  if (!createResult.ok) {
    const status =
      createResult.reason === "SAME_FOLDER" || createResult.reason === "DUPLICATE" || createResult.reason === "INVALID_SECTION"
        ? 400
        : 404;
    return NextResponse.json({ ok: false, reason: createResult.reason }, { status });
  }

  return NextResponse.json({ ok: true, shortcutId: createResult.shortcutId }, { status: 201 });
}
