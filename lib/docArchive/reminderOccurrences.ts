import type { ArchiveReminderEntityKind, RecurrenceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { archivePrisma } from "@/lib/docArchive/client";
import { addDaysIso, compareIsoDate, getOsloDateKey } from "@/lib/dates/isoDate";
import { matchesRecurrence } from "@/lib/orders/recurringOrders/occurrenceDates";

// Per-occurrence backlog for a recurring archive reminder — see the
// ArchiveReminderOccurrence model comment in prisma/schema.prisma for why
// this exists alongside (not instead of) the older, deliberately stateless
// lib/docArchive/reminderRecurrence.ts cron: that cron keeps rolling the
// entity's single dueAt forward for browse-page badges; this table tracks
// individual matching dates so the dashboard Reminders widget can show and
// act on more than one at a time. The two are allowed to diverge (confirmed
// with the user) — this file never touches dueAt.

export const OVERDUE_LOOKBACK_DAYS = 14;
export const UPCOMING_WINDOW_DAYS = 7;
export const SNOOZE_DAYS = 7;
const MAX_MISSED_PER_ENTITY = 5;

// Same narrow-local-type-cast workaround as reminderRecurrence.ts's
// ArchiveReminderQueryClient — archivePrisma is typed as the package's
// internal-only contract but is a real PrismaClient at runtime.
type ArchiveEntityRow = { id: string; companyId: string; tenantId: string; deletedAt: Date | null };

type ArchiveEntityQueryClient = {
  archiveFolder: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; companyId: true; tenantId: true; deletedAt: true };
    }): Promise<ArchiveEntityRow[]>;
  };
  archiveItem: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; companyId: true; tenantId: true; deletedAt: true };
    }): Promise<ArchiveEntityRow[]>;
  };
};

const db = archivePrisma as unknown as ArchiveEntityQueryClient;

// Same $queryRawUnsafe-against-archivePrisma pattern as folderStats.ts —
// only `name`/`folderId` are needed here (not `description`): the Reminders
// widget displays the reminder note's own description, via
// getFolderReminderSettingsBatch/getItemReminderSettingsBatch, not the
// entity's real business description.
type ArchiveDisplayQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

const displayDb = archivePrisma as unknown as ArchiveDisplayQueryClient;

export async function getFolderOccurrenceDisplayInfo(
  companyId: string,
  tenantId: string,
  folderIds: string[],
): Promise<Map<string, { name: string }>> {
  const map = new Map<string, { name: string }>();
  if (folderIds.length === 0) return map;

  const rows = await displayDb.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT "id" AS "id", "name" AS "name" FROM archive."archive_folders"
     WHERE "companyId" = $1 AND "tenantId" = $2 AND "id" = ANY($3::uuid[]) AND "deletedAt" IS NULL`,
    companyId,
    tenantId,
    folderIds,
  );

  for (const row of rows) map.set(row.id, { name: row.name });
  return map;
}

export async function getItemOccurrenceDisplayInfo(
  companyId: string,
  tenantId: string,
  itemIds: string[],
): Promise<Map<string, { name: string; folderId: string }>> {
  const map = new Map<string, { name: string; folderId: string }>();
  if (itemIds.length === 0) return map;

  const rows = await displayDb.$queryRawUnsafe<{ id: string; name: string; folderId: string }[]>(
    `SELECT "id" AS "id", "name" AS "name", "folderId" AS "folderId" FROM archive."archive_items"
     WHERE "companyId" = $1 AND "tenantId" = $2 AND "id" = ANY($3::uuid[]) AND "deletedAt" IS NULL`,
    companyId,
    tenantId,
    itemIds,
  );

  for (const row of rows) map.set(row.id, { name: row.name, folderId: row.folderId });
  return map;
}

type EntitySettings = { recurrenceType: RecurrenceType | null; recurrenceConfig: unknown };

// Reconciles (drops rows that no longer match the entity's current pattern,
// or all of them if recurrence was cleared) then generates any missing
// matching dates within the [today-OVERDUE_LOOKBACK_DAYS,
// today+UPCOMING_WINDOW_DAYS] window, then caps how many *past* PENDING rows
// stay actionable so one neglected reminder can't monopolize the dashboard.
async function reconcileAndGenerateForEntity(
  entityKind: ArchiveReminderEntityKind,
  entityId: string,
  companyId: string,
  tenantId: string,
  settings: EntitySettings,
  today: string,
): Promise<void> {
  const { recurrenceType, recurrenceConfig } = settings;

  await prisma.$transaction(async (tx) => {
    const existingRows = await tx.archiveReminderOccurrence.findMany({
      where: { entityKind, entityId, status: { in: ["PENDING", "SNOOZED"] } },
      select: { id: true, occurrenceDate: true },
    });

    const staleIds = existingRows
      .filter((row) => !recurrenceType || !matchesRecurrence(row.occurrenceDate, recurrenceType, recurrenceConfig))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await tx.archiveReminderOccurrence.deleteMany({ where: { id: { in: staleIds } } });
    }

    if (!recurrenceType) return;

    const windowStart = addDaysIso(today, -OVERDUE_LOOKBACK_DAYS);
    const windowEnd = addDaysIso(today, UPCOMING_WINDOW_DAYS);

    const candidateDates: string[] = [];
    for (let cursor = windowStart; compareIsoDate(cursor, windowEnd) <= 0; cursor = addDaysIso(cursor, 1)) {
      if (matchesRecurrence(cursor, recurrenceType, recurrenceConfig)) candidateDates.push(cursor);
    }

    if (candidateDates.length > 0) {
      // skipDuplicates relies on the (entityKind, entityId, occurrenceDate)
      // unique constraint to silently no-op on already-existing rows
      // (any status, including DONE/SNOOZED) — a true INSERT ... ON CONFLICT
      // DO NOTHING, so it never touches/bumps an existing row's updatedAt.
      await tx.archiveReminderOccurrence.createMany({
        data: candidateDates.map((occurrenceDate) => ({
          companyId,
          tenantId,
          entityKind,
          entityId,
          occurrenceDate,
          status: "PENDING" as const,
        })),
        skipDuplicates: true,
      });
    }

    const missedPast = await tx.archiveReminderOccurrence.findMany({
      where: { entityKind, entityId, status: "PENDING", occurrenceDate: { lt: today } },
      orderBy: { occurrenceDate: "asc" },
      select: { id: true },
    });

    if (missedPast.length > MAX_MISSED_PER_ENTITY) {
      const excessIds = missedPast.slice(0, missedPast.length - MAX_MISSED_PER_ENTITY).map((row) => row.id);
      await tx.archiveReminderOccurrence.updateMany({
        where: { id: { in: excessIds } },
        data: { status: "DONE", resolvedAt: new Date() },
      });
    }
  });
}

// accept marks the specific occurrence done; snooze pushes its *effective*
// date forward by SNOOZE_DAYS without touching occurrenceDate (its
// immutable identity) — same ownership-check shape as
// lib/docArchive/textFields.ts's updateItemTextField (findFirst scoped to
// companyId before mutating, 404-shaped failure otherwise).
export async function resolveArchiveReminderOccurrence(
  companyId: string,
  occurrenceId: string,
  action: "accept" | "snooze",
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" }> {
  const existing = await prisma.archiveReminderOccurrence.findFirst({
    where: { id: occurrenceId, companyId },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  if (action === "accept") {
    await prisma.archiveReminderOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "DONE", resolvedAt: new Date() },
    });
  } else {
    await prisma.archiveReminderOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "SNOOZED", snoozedUntil: addDaysIso(getOsloDateKey(), SNOOZE_DAYS) },
    });
  }

  return { ok: true };
}

export async function generateAndReconcileArchiveReminderOccurrences(
  options: { companyId?: string } = {},
): Promise<void> {
  const today = getOsloDateKey();
  const companyFilter = options.companyId ? { companyId: options.companyId } : {};

  // Folders
  const folderNotes = await prisma.archiveFolderReminderNote.findMany({
    where: { recurrenceType: { not: null }, ...companyFilter },
    select: { folderId: true, recurrenceType: true, recurrenceConfig: true },
  });
  const folderOccurrenceEntities = await prisma.archiveReminderOccurrence.findMany({
    where: { entityKind: "FOLDER", status: { in: ["PENDING", "SNOOZED"] }, ...companyFilter },
    distinct: ["entityId"],
    select: { entityId: true },
  });
  // Settings lookup for the current pass — any folderId not present here has
  // recurrenceType: null as of the query above (either no note row, or one
  // with recurrenceType already null), which is exactly what
  // reconcileAndGenerateForEntity needs to know to prune stale rows for a
  // just-cleared/narrowed recurrence.
  const folderSettingsById = new Map<string, EntitySettings>(
    folderNotes.map((note) => [
      note.folderId,
      { recurrenceType: note.recurrenceType, recurrenceConfig: note.recurrenceType ? note.recurrenceConfig : null },
    ]),
  );
  const folderIds = [...new Set([...folderNotes.map((n) => n.folderId), ...folderOccurrenceEntities.map((r) => r.entityId)])];

  if (folderIds.length > 0) {
    const rows = await db.archiveFolder.findMany({
      where: { id: { in: folderIds } },
      select: { id: true, companyId: true, tenantId: true, deletedAt: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (const folderId of folderIds) {
      const row = rowById.get(folderId);
      if (!row || row.deletedAt) continue;

      const settings = folderSettingsById.get(folderId) ?? { recurrenceType: null, recurrenceConfig: null };
      await reconcileAndGenerateForEntity("FOLDER", folderId, row.companyId, row.tenantId, settings, today);
    }
  }

  // Items — same shape as the folder block above
  const itemNotes = await prisma.archiveItemReminderNote.findMany({
    where: { recurrenceType: { not: null }, ...companyFilter },
    select: { itemId: true, recurrenceType: true, recurrenceConfig: true },
  });
  const itemOccurrenceEntities = await prisma.archiveReminderOccurrence.findMany({
    where: { entityKind: "ITEM", status: { in: ["PENDING", "SNOOZED"] }, ...companyFilter },
    distinct: ["entityId"],
    select: { entityId: true },
  });
  const itemSettingsById = new Map<string, EntitySettings>(
    itemNotes.map((note) => [
      note.itemId,
      { recurrenceType: note.recurrenceType, recurrenceConfig: note.recurrenceType ? note.recurrenceConfig : null },
    ]),
  );
  const itemIds = [...new Set([...itemNotes.map((n) => n.itemId), ...itemOccurrenceEntities.map((r) => r.entityId)])];

  if (itemIds.length > 0) {
    const rows = await db.archiveItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, companyId: true, tenantId: true, deletedAt: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (const itemId of itemIds) {
      const row = rowById.get(itemId);
      if (!row || row.deletedAt) continue;

      const settings = itemSettingsById.get(itemId) ?? { recurrenceType: null, recurrenceConfig: null };
      await reconcileAndGenerateForEntity("ITEM", itemId, row.companyId, row.tenantId, settings, today);
    }
  }
}
