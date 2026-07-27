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
  const readResult = await archive.readItem(ctx, itemId);

  if (!readResult.ok) {
    return NextResponse.json(
      { ok: false, reason: readResult.error.category, message: readResult.error.message },
      { status: archiveErrorStatus(readResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, item: readResult.value });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const deleteResult = await archive.softDeleteItem(ctx, itemId);

  if (!deleteResult.ok) {
    return NextResponse.json(
      { ok: false, reason: deleteResult.error.category, message: deleteResult.error.message },
      { status: archiveErrorStatus(deleteResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, item: deleteResult.value });
}
