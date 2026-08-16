import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import {
  buildArchiveContext,
  ensureNamespaceBootstrapped,
  grantFolderCreatorCapabilities,
} from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { withFolderStats } from "@/lib/docArchive/withFolderStats";
import { assignFolderCode } from "@/lib/docArchive/folderCodes";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listRootFolders(ctx);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  const folders = await withFolderStats(ctx, listResult.value);

  return NextResponse.json({ ok: true, folders });
}

export async function POST(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;

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
  const parentFolderId =
    typeof body?.parentFolderId === "string" ? body.parentFolderId.trim() || null : null;
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";

  if (!sectionId) {
    return NextResponse.json(
      { ok: false, reason: "SECTION_REQUIRED" },
      { status: 400 },
    );
  }

  const ctx = buildArchiveContext(session, membership);

  if (!(await sectionBelongsToScope(ctx.companyId, ctx.tenantId, parentFolderId, sectionId))) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_SECTION" },
      { status: 400 },
    );
  }

  if (!parentFolderId) {
    await ensureNamespaceBootstrapped(ctx, membership.role);
  }

  const createResult = await archive.createFolder(ctx, { name, description, parentFolderId });

  if (!createResult.ok) {
    return NextResponse.json(
      { ok: false, reason: createResult.error.category, message: createResult.error.message },
      { status: archiveErrorStatus(createResult.error.category) },
    );
  }

  await grantFolderCreatorCapabilities(ctx, createResult.value.id);
  await assignFolderCode(ctx.companyId, ctx.tenantId, createResult.value.id, parentFolderId, sectionId);

  return NextResponse.json({ ok: true, folder: { ...createResult.value, sectionId } }, { status: 201 });
}
