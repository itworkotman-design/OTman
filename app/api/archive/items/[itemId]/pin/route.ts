import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

// Personal per-user preference (0.2.0 delivery) — the package itself only
// requires `view` on the item, not `manage_*`, and writes no canonical
// event. This host restricts it to ADMIN-level archive access anyway (not a
// package requirement): pinning is treated as one of the "settings" actions
// alongside rename/archive/move/delete, all admin-only per explicit product
// decision — only Copy Link is available to plain viewers. The UI already
// hides the pin star from non-admins (PillHoverActions), but that alone
// isn't real enforcement, so it's gated here too. unpinItem has no
// target-existence check by design (removing a stale pin always succeeds
// indistinguishably), so DELETE never surfaces a not_found either.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const pinResult = await archive.pinItem(ctx, itemId);

  if (!pinResult.ok) {
    return NextResponse.json(
      { ok: false, reason: pinResult.error.category, message: pinResult.error.message },
      { status: archiveErrorStatus(pinResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, item: pinResult.value });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const unpinResult = await archive.unpinItem(ctx, itemId);

  if (!unpinResult.ok) {
    return NextResponse.json(
      { ok: false, reason: unpinResult.error.category, message: unpinResult.error.message },
      { status: archiveErrorStatus(unpinResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true });
}
