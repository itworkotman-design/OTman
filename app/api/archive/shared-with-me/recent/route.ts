import { NextResponse } from "next/server";
import type { ArchiveReminderEntityKind } from "@prisma/client";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { listRecentSharedOpens, recordSharedOpen } from "@/lib/docArchive/sharedRecentOpens";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

// Powers the archive root page's "Shared with you" preview — see
// SharedWithYouSection.tsx. GET returns the caller's most-recently-opened
// shared folders/items; POST records an open (called from FolderView/
// ItemView's "sharedId" linkMode, the id-based routes reached only through
// "Shared with me").
export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  const ctx = buildArchiveContext(result.session, result.membership);
  const { folders, items } = await listRecentSharedOpens(ctx, limit);

  return NextResponse.json({ ok: true, folders, items });
}

export async function POST(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => null);
  const entityKind: ArchiveReminderEntityKind | undefined = body?.entityKind;
  const entityId: string | undefined = body?.entityId;

  if ((entityKind !== "FOLDER" && entityKind !== "ITEM") || !entityId) {
    return NextResponse.json({ ok: false, reason: "INVALID_TARGET" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);

  // Re-verify the caller can actually read this target before recording it
  // — defense in depth against recording an arbitrary id, even though every
  // real caller only hits this after already loading the entity itself.
  const readResult = entityKind === "FOLDER" ? await archive.readFolder(ctx, entityId) : await archive.readItem(ctx, entityId);

  if (!readResult.ok) {
    return NextResponse.json(
      { ok: false, reason: readResult.error.category, message: readResult.error.message },
      { status: archiveErrorStatus(readResult.error.category) },
    );
  }

  await recordSharedOpen(ctx.companyId, ctx.tenantId, ctx.userId, entityKind, entityId);

  return NextResponse.json({ ok: true });
}
