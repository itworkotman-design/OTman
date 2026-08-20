import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { assignItemCode } from "@/lib/docArchive/folderCodes";
import { withItemStats } from "@/lib/docArchive/withItemStats";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listItemsInFolder(ctx, folderId);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  const items = await withItemStats(ctx, listResult.value);

  return NextResponse.json({ ok: true, items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;
  const { folderId } = await params;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;
  // Sections are optional — an item can be created with no section at all
  // (renders in the "Ungrouped" bucket) and moved into a section later.
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() || null : null;

  const ctx = buildArchiveContext(session, membership);

  if (sectionId && !(await sectionBelongsToScope(ctx.companyId, ctx.tenantId, folderId, sectionId))) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_SECTION" },
      { status: 400 },
    );
  }

  const createResult = await archive.createItem(ctx, { folderId, name, description });

  if (!createResult.ok) {
    return NextResponse.json(
      { ok: false, reason: createResult.error.category, message: createResult.error.message },
      { status: archiveErrorStatus(createResult.error.category) },
    );
  }

  await assignItemCode(ctx.companyId, ctx.tenantId, createResult.value.id, folderId, sectionId);

  return NextResponse.json({ ok: true, item: { ...createResult.value, sectionId } }, { status: 201 });
}
