import { Prisma, type RecurrenceType } from "@prisma/client";
import { prisma } from "@/lib/db";

// Reminder settings are host-side-only (like ArchiveFolderCode/ArchiveItemCode)
// since the archive package's own `description`/`dueAt` fields aren't meant
// for this: `description` is the real business description, and `dueAt` is a
// single point in time, not a repeating schedule. recurrenceType/
// recurrenceConfig mirror RecurringOrderTemplate's own fields exactly (see
// lib/orders/recurringOrders/occurrenceDates.ts for the shared
// matchesRecurrence/isRecurrenceConfigValid logic reused by
// lib/docArchive/reminderRecurrence.ts) — both null here means "no
// recurrence", which a scheduler order template can never have but a
// reminder can. A row only exists once either field has been explicitly set;
// clearing both deletes the row rather than storing empty/null values
// forever.
export type ArchiveReminderSettings = {
  description: string | null;
  recurrenceType: RecurrenceType | null;
  recurrenceConfig: unknown | null;
};

const EMPTY_SETTINGS: ArchiveReminderSettings = { description: null, recurrenceType: null, recurrenceConfig: null };

function toSettings(row: { description: string; recurrenceType: RecurrenceType | null; recurrenceConfig: unknown }): ArchiveReminderSettings {
  return {
    description: row.description || null,
    recurrenceType: row.recurrenceType,
    recurrenceConfig: row.recurrenceType ? row.recurrenceConfig : null,
  };
}

export async function getFolderReminderSettings(folderId: string): Promise<ArchiveReminderSettings> {
  const row = await prisma.archiveFolderReminderNote.findUnique({
    where: { folderId },
    select: { description: true, recurrenceType: true, recurrenceConfig: true },
  });
  return row ? toSettings(row) : EMPTY_SETTINGS;
}

export async function getItemReminderSettings(itemId: string): Promise<ArchiveReminderSettings> {
  const row = await prisma.archiveItemReminderNote.findUnique({
    where: { itemId },
    select: { description: true, recurrenceType: true, recurrenceConfig: true },
  });
  return row ? toSettings(row) : EMPTY_SETTINGS;
}

export async function setFolderReminderSettings(
  companyId: string,
  tenantId: string,
  folderId: string,
  settings: ArchiveReminderSettings,
): Promise<void> {
  if (settings.description === null && settings.recurrenceType === null) {
    await prisma.archiveFolderReminderNote.deleteMany({ where: { folderId } });
    return;
  }

  const description = settings.description ?? "";
  const data = {
    description,
    recurrenceType: settings.recurrenceType,
    recurrenceConfig: settings.recurrenceType
      ? ((settings.recurrenceConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
  await prisma.archiveFolderReminderNote.upsert({
    where: { folderId },
    create: { companyId, tenantId, folderId, ...data },
    update: data,
  });
}

export async function setItemReminderSettings(
  companyId: string,
  tenantId: string,
  itemId: string,
  settings: ArchiveReminderSettings,
): Promise<void> {
  if (settings.description === null && settings.recurrenceType === null) {
    await prisma.archiveItemReminderNote.deleteMany({ where: { itemId } });
    return;
  }

  const description = settings.description ?? "";
  const data = {
    description,
    recurrenceType: settings.recurrenceType,
    recurrenceConfig: settings.recurrenceType
      ? ((settings.recurrenceConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
  await prisma.archiveItemReminderNote.upsert({
    where: { itemId },
    create: { companyId, tenantId, itemId, ...data },
    update: data,
  });
}

export async function getFolderReminderSettingsBatch(
  folderIds: string[],
): Promise<Map<string, ArchiveReminderSettings>> {
  const map = new Map<string, ArchiveReminderSettings>();
  if (folderIds.length === 0) return map;

  const rows = await prisma.archiveFolderReminderNote.findMany({
    where: { folderId: { in: folderIds } },
    select: { folderId: true, description: true, recurrenceType: true, recurrenceConfig: true },
  });

  for (const row of rows) {
    map.set(row.folderId, toSettings(row));
  }
  return map;
}

export async function getItemReminderSettingsBatch(
  itemIds: string[],
): Promise<Map<string, ArchiveReminderSettings>> {
  const map = new Map<string, ArchiveReminderSettings>();
  if (itemIds.length === 0) return map;

  const rows = await prisma.archiveItemReminderNote.findMany({
    where: { itemId: { in: itemIds } },
    select: { itemId: true, description: true, recurrenceType: true, recurrenceConfig: true },
  });

  for (const row of rows) {
    map.set(row.itemId, toSettings(row));
  }
  return map;
}
