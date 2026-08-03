import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

function parseDateField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);

  const dueAt = parseDateField(body?.dueAt);
  const expiresAt = parseDateField(body?.expiresAt);

  const ctx = buildArchiveContext(result.session, result.membership);
  const updateResult = await archive.setItemDates(ctx, itemId, { dueAt, expiresAt });

  if (!updateResult.ok) {
    return NextResponse.json(
      { ok: false, reason: updateResult.error.category, message: updateResult.error.message },
      { status: archiveErrorStatus(updateResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, item: updateResult.value });
}
