import { NextResponse } from "next/server";
import type { ArchiveBusinessStatus, ArchiveFolderSearchQuery } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { getFolderCodes } from "@/lib/docArchive/folderCodes";

const VALID_STATUSES: ArchiveBusinessStatus[] = ["active", "inactive", "draft", "archived"];

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const url = new URL(req.url);
  const params = url.searchParams;

  const query: ArchiveFolderSearchQuery = {};

  const nameContains = params.get("nameContains")?.trim();
  if (nameContains) query.nameContains = nameContains;

  const status = params.get("status");
  if (status && VALID_STATUSES.includes(status as ArchiveBusinessStatus)) {
    query.status = status as ArchiveBusinessStatus;
  }

  if (params.get("isOverdue") === "true") query.isOverdue = true;
  if (params.get("isDueSoon") === "true") query.isDueSoon = true;
  if (params.get("isExpiringSoon") === "true") query.isExpiringSoon = true;
  if (params.get("isExpired") === "true") query.isExpired = true;

  const cursor = params.get("cursor");
  if (cursor) query.cursor = cursor;

  const ctx = buildArchiveContext(result.session, result.membership);
  const searchResult = await archive.searchFolders(ctx, query);

  if (!searchResult.ok) {
    return NextResponse.json(
      { ok: false, reason: searchResult.error.category, message: searchResult.error.message },
      { status: archiveErrorStatus(searchResult.error.category) },
    );
  }

  const codes = await getFolderCodes(
    ctx.companyId,
    ctx.tenantId,
    searchResult.value.items.map((folder) => folder.id),
  );
  const items = searchResult.value.items.map((folder) => ({ ...folder, code: codes.get(folder.id) ?? "?" }));

  return NextResponse.json({ ok: true, items, nextCursor: searchResult.value.nextCursor });
}
