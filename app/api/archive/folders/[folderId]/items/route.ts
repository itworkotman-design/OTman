import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { assignItemCode, getItemCodes } from "@/lib/docArchive/folderCodes";

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

  const codes = await getItemCodes(
    ctx.companyId,
    ctx.tenantId,
    listResult.value.map((item) => ({ id: item.id, folderId: item.folderId })),
  );

  const items = listResult.value.map((item) => ({ ...item, code: codes.get(item.id) ?? "?" }));

  return NextResponse.json({ ok: true, items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
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

  const ctx = buildArchiveContext(session, membership);
  const createResult = await archive.createItem(ctx, { folderId, name, description });

  if (!createResult.ok) {
    return NextResponse.json(
      { ok: false, reason: createResult.error.category, message: createResult.error.message },
      { status: archiveErrorStatus(createResult.error.category) },
    );
  }

  await assignItemCode(ctx.companyId, ctx.tenantId, createResult.value.id, folderId);

  return NextResponse.json({ ok: true, item: createResult.value }, { status: 201 });
}
