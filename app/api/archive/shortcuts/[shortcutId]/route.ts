import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { deleteItemShortcut, getShortcutDetail } from "@/lib/docArchive/shortcuts";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shortcutId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { shortcutId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const detail = await getShortcutDetail(ctx, shortcutId);

  if (!detail.ok) {
    return NextResponse.json({ ok: false, reason: detail.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true, shortcut: detail.shortcut, item: detail.item });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ shortcutId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { shortcutId } = await params;
  const { session, membership } = result;
  const ctx = buildArchiveContext(session, membership);
  const deleteResult = await deleteItemShortcut(ctx, shortcutId);

  if (!deleteResult.ok) {
    const status = deleteResult.reason === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ ok: false, reason: deleteResult.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
