import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import {
  generateAndReconcileArchiveReminderOccurrences,
  getFolderOccurrenceDisplayInfo,
  getItemOccurrenceDisplayInfo,
  UPCOMING_WINDOW_DAYS,
} from "@/lib/docArchive/reminderOccurrences";
import { getFolderReminderSettingsBatch, getItemReminderSettingsBatch } from "@/lib/docArchive/reminderNotes";
import { getFolderCodes, getItemCodes } from "@/lib/docArchive/folderCodes";
import { addDaysIso, getOsloDateKey } from "@/lib/dates/isoDate";

// The dashboard Reminders widget's per-occurrence data source — lists
// individual missed/overdue and upcoming-preview dates for recurring
// reminders (see lib/docArchive/reminderOccurrences.ts). Generation runs
// lazily on every read (self-healing, same precedent as
// lib/docArchive/contentSections.ts's assignOrphanFiles) so this works
// without the archive-reminder-occurrences cron being wired up, e.g. in dev.
export async function GET(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { membership } = result;
  const companyId = membership.companyId;
  const tenantId = companyId;

  await generateAndReconcileArchiveReminderOccurrences({ companyId });

  const today = getOsloDateKey();
  const upcomingCutoff = addDaysIso(today, UPCOMING_WINDOW_DAYS);

  const rows = await prisma.archiveReminderOccurrence.findMany({
    where: {
      companyId,
      OR: [
        { status: "PENDING", occurrenceDate: { lte: upcomingCutoff } },
        { status: "SNOOZED", snoozedUntil: { lte: today } },
      ],
    },
  });

  const folderRows = rows.filter((row) => row.entityKind === "FOLDER");
  const itemRows = rows.filter((row) => row.entityKind === "ITEM");

  const [folderDisplay, folderReminderSettings, itemDisplay, itemReminderSettings] = await Promise.all([
    getFolderOccurrenceDisplayInfo(companyId, tenantId, folderRows.map((row) => row.entityId)),
    getFolderReminderSettingsBatch(folderRows.map((row) => row.entityId)),
    getItemOccurrenceDisplayInfo(companyId, tenantId, itemRows.map((row) => row.entityId)),
    getItemReminderSettingsBatch(itemRows.map((row) => row.entityId)),
  ]);

  const folderCodes = await getFolderCodes(companyId, tenantId, [...folderDisplay.keys()]);
  const itemCodes = await getItemCodes(
    companyId,
    tenantId,
    [...itemDisplay.entries()].map(([id, info]) => ({ id, folderId: info.folderId })),
  );

  const occurrences = rows
    .map((row) => {
      // Effective date: a resurfaced SNOOZED row must display/sort by the
      // date it was snoozed TO, not its original (possibly much older)
      // occurrenceDate.
      const date = row.status === "SNOOZED" && row.snoozedUntil ? row.snoozedUntil : row.occurrenceDate;

      if (row.entityKind === "FOLDER") {
        const display = folderDisplay.get(row.entityId);
        if (!display) return null; // entity missing/soft-deleted — drop silently
        return {
          id: row.id,
          entityKind: "folder" as const,
          entityId: row.entityId,
          code: folderCodes.get(row.entityId) ?? "?",
          name: display.name,
          description: folderReminderSettings.get(row.entityId)?.description ?? null,
          date: `${date}T00:00:00.000Z`,
          status: row.status,
        };
      }

      const display = itemDisplay.get(row.entityId);
      if (!display) return null;
      return {
        id: row.id,
        entityKind: "item" as const,
        entityId: row.entityId,
        code: itemCodes.get(row.entityId) ?? "?",
        name: display.name,
        description: itemReminderSettings.get(row.entityId)?.description ?? null,
        date: `${date}T00:00:00.000Z`,
        status: row.status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ ok: true, occurrences });
}
