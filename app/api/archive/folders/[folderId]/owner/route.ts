import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  const ownerUserId = typeof body?.ownerUserId === "string" ? body.ownerUserId.trim() : "";

  if (!ownerUserId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const updateResult = await archive.setFolderOwner(ctx, folderId, { ownerUserId });

  if (!updateResult.ok) {
    return NextResponse.json(
      { ok: false, reason: updateResult.error.category, message: updateResult.error.message },
      { status: archiveErrorStatus(updateResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, folder: updateResult.value });
}
