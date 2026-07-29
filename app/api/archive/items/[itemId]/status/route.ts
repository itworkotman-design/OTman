import { NextResponse } from "next/server";
import type { ArchiveBusinessStatus } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

const VALID_STATUSES: ArchiveBusinessStatus[] = ["active", "inactive", "draft", "archived"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as ArchiveBusinessStatus)) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const updateResult = await archive.setItemStatus(ctx, itemId, { status: status as ArchiveBusinessStatus });

  if (!updateResult.ok) {
    return NextResponse.json(
      { ok: false, reason: updateResult.error.category, message: updateResult.error.message },
      { status: archiveErrorStatus(updateResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, item: updateResult.value });
}
