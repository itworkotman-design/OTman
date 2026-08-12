import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { setFileDescription } from "@/lib/docArchive/fileDescriptions";

const MAX_DESCRIPTION_LENGTH = 2000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fileId } = await params;
  const body = await req.json().catch(() => null);
  const description = body?.description;

  if (typeof description !== "string" || description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, reason: "INVALID_DESCRIPTION" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  // Confirms the file actually exists and this caller can reach it before
  // writing to our own host-side table — readFile enforces the same
  // permission checks (namespace/tenant + view access) as every other file
  // route, so an admin on a different folder/tenant can't attach a
  // description to a fileId they don't otherwise have access to.
  const readResult = await archive.readFile(ctx, fileId);
  if (!readResult.ok) {
    return NextResponse.json(
      { ok: false, reason: readResult.error.category, message: readResult.error.message },
      { status: archiveErrorStatus(readResult.error.category) },
    );
  }

  const saved = await setFileDescription(ctx.companyId, ctx.tenantId, fileId, description);
  return NextResponse.json({ ok: true, description: saved });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fileId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const deleteResult = await archive.softDeleteFile(ctx, fileId);

  if (!deleteResult.ok) {
    return NextResponse.json(
      { ok: false, reason: deleteResult.error.category, message: deleteResult.error.message },
      { status: archiveErrorStatus(deleteResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, file: deleteResult.value });
}
