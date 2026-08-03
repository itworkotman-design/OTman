import { NextResponse } from "next/server";
import type { ArchiveBusinessStatus, ArchiveItemSearchQuery } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { getItemCodes } from "@/lib/docArchive/folderCodes";
import { getItemReminderSettingsBatch } from "@/lib/docArchive/reminderNotes";

const VALID_STATUSES: ArchiveBusinessStatus[] = ["active", "inactive", "draft", "archived"];

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const url = new URL(req.url);
  const params = url.searchParams;

  const query: ArchiveItemSearchQuery = {};

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

  const folderId = params.get("folderId")?.trim();
  if (folderId) query.folderId = folderId;

  const cursor = params.get("cursor");
  if (cursor) query.cursor = cursor;

  const ctx = buildArchiveContext(result.session, result.membership);
  const searchResult = await archive.searchItems(ctx, query);

  if (!searchResult.ok) {
    return NextResponse.json(
      { ok: false, reason: searchResult.error.category, message: searchResult.error.message },
      { status: archiveErrorStatus(searchResult.error.category) },
    );
  }

  const itemIds = searchResult.value.items.map((item) => item.id);
  const [codes, reminderSettings] = await Promise.all([
    getItemCodes(
      ctx.companyId,
      ctx.tenantId,
      searchResult.value.items.map((item) => ({ id: item.id, folderId: item.folderId })),
    ),
    getItemReminderSettingsBatch(itemIds),
  ]);
  const items = searchResult.value.items.map((item) => ({
    ...item,
    code: codes.get(item.id) ?? "?",
    reminderDescription: reminderSettings.get(item.id)?.description ?? null,
    reminderRecurrenceType: reminderSettings.get(item.id)?.recurrenceType ?? null,
    reminderRecurrenceConfig: reminderSettings.get(item.id)?.recurrenceConfig ?? null,
  }));

  return NextResponse.json({ ok: true, items, nextCursor: searchResult.value.nextCursor });
}
