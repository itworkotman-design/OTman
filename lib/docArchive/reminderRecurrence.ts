import type { ArchiveContextInput } from "@customprojects/custom-archive";
import type { RecurrenceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { archive, archivePrisma } from "@/lib/docArchive/client";
import { addDaysIso, compareIsoDate, getOsloDateKey } from "@/lib/dates/isoDate";
import { matchesRecurrence } from "@/lib/orders/recurringOrders/occurrenceDates";

// Same "no in-process scheduler" shape as the Scheduler Orders cron
// (lib/orders/recurringOrders/generateDueOccurrences.ts): a reminder with a
// recurrence rule set only actually loops when something calls this. Unlike
// order generation, advancing a due date needs no separate
// occurrence-tracking table for idempotency — creating an Order is a new
// persistent side effect that must not be duplicated, but re-deriving "the
// next date the rule matches, after today" always converges to the same
// value no matter how many times or how late it runs.
//
// `matchesRecurrence` (from the Scheduler Orders code) is reused as-is
// rather than duplicated — it's already a pure function of (date, type,
// config) with no order-specific behavior baked in.

export type AdvanceDueArchiveRemindersSummary = {
  foldersProcessed: number;
  foldersAdvanced: number;
  foldersExhausted: number;
  foldersFailed: number;
  itemsProcessed: number;
  itemsAdvanced: number;
  itemsExhausted: number;
  itemsFailed: number;
};

// `archivePrisma` is typed as the package's narrow internal
// `PrismaArchiveHostAdapterClient` contract, not a general query client, but
// at runtime it's a real generated PrismaClient — same local-type-cast
// workaround as runArchiveRetentionSweep.ts/folderStats.ts, scoped to exactly
// the fields this needs: the current dueAt (to know if/where the loop is),
// createdByUserId (createFolder/createItem only auto-grants manage_metadata
// to the creator, so re-using their id as the ctx.userId is what makes
// setFolderDates/setItemDates authorized here without any extra plumbing),
// and deletedAt (never loop a soft-deleted entity).
type ArchiveDueRow = { id: string; companyId: string; tenantId: string; dueAt: Date | null; createdByUserId: string; deletedAt: Date | null };

type ArchiveReminderQueryClient = {
  archiveFolder: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; companyId: true; tenantId: true; dueAt: true; createdByUserId: true; deletedAt: true };
    }): Promise<ArchiveDueRow[]>;
  };
  archiveItem: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; companyId: true; tenantId: true; dueAt: true; createdByUserId: true; deletedAt: true };
    }): Promise<ArchiveDueRow[]>;
  };
};

const db = archivePrisma as unknown as ArchiveReminderQueryClient;

// Safety cap matching computeUpcomingOccurrenceDates's own MAX_DAYS_SCANNED —
// protects against scanning forever for a rule that will never match again
// (e.g. CUSTOM_DATES whose configured dates are all in the past).
const MAX_DAYS_SCANNED = 3660;

function findNextMatchingDate(recurrenceType: RecurrenceType, recurrenceConfig: unknown, today: string): string | null {
  let cursor = addDaysIso(today, 1);

  for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
    if (matchesRecurrence(cursor, recurrenceType, recurrenceConfig)) {
      return cursor;
    }
    cursor = addDaysIso(cursor, 1);
  }

  return null;
}

export async function advanceDueArchiveReminders(
  options: { companyId?: string } = {},
): Promise<AdvanceDueArchiveRemindersSummary> {
  const today = getOsloDateKey();
  const summary: AdvanceDueArchiveRemindersSummary = {
    foldersProcessed: 0,
    foldersAdvanced: 0,
    foldersExhausted: 0,
    foldersFailed: 0,
    itemsProcessed: 0,
    itemsAdvanced: 0,
    itemsExhausted: 0,
    itemsFailed: 0,
  };

  const folderNotes = await prisma.archiveFolderReminderNote.findMany({
    where: {
      recurrenceType: { not: null },
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    select: { folderId: true, recurrenceType: true, recurrenceConfig: true },
  });

  if (folderNotes.length > 0) {
    const rows = await db.archiveFolder.findMany({
      where: { id: { in: folderNotes.map((note) => note.folderId) } },
      select: { id: true, companyId: true, tenantId: true, dueAt: true, createdByUserId: true, deletedAt: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (const note of folderNotes) {
      const row = rowById.get(note.folderId);
      if (!row || row.deletedAt || !row.dueAt || !note.recurrenceType) continue;

      const currentDueIso = getOsloDateKey(row.dueAt);
      if (compareIsoDate(currentDueIso, today) > 0) continue;

      summary.foldersProcessed += 1;
      const nextDueDate = findNextMatchingDate(note.recurrenceType, note.recurrenceConfig, today);

      if (!nextDueDate) {
        summary.foldersExhausted += 1;
        continue;
      }

      const ctx: ArchiveContextInput = {
        userId: row.createdByUserId,
        companyId: row.companyId,
        tenantId: row.tenantId,
        archiveModuleAccess: true,
      };

      const result = await archive.setFolderDates(ctx, note.folderId, {
        dueAt: `${nextDueDate}T00:00:00.000Z`,
      });

      if (result.ok) {
        summary.foldersAdvanced += 1;
      } else {
        summary.foldersFailed += 1;
        console.error(
          `[archive-reminders] failed to advance folder ${note.folderId} due date:`,
          result.error.message,
        );
      }
    }
  }

  const itemNotes = await prisma.archiveItemReminderNote.findMany({
    where: {
      recurrenceType: { not: null },
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    select: { itemId: true, recurrenceType: true, recurrenceConfig: true },
  });

  if (itemNotes.length > 0) {
    const rows = await db.archiveItem.findMany({
      where: { id: { in: itemNotes.map((note) => note.itemId) } },
      select: { id: true, companyId: true, tenantId: true, dueAt: true, createdByUserId: true, deletedAt: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (const note of itemNotes) {
      const row = rowById.get(note.itemId);
      if (!row || row.deletedAt || !row.dueAt || !note.recurrenceType) continue;

      const currentDueIso = getOsloDateKey(row.dueAt);
      if (compareIsoDate(currentDueIso, today) > 0) continue;

      summary.itemsProcessed += 1;
      const nextDueDate = findNextMatchingDate(note.recurrenceType, note.recurrenceConfig, today);

      if (!nextDueDate) {
        summary.itemsExhausted += 1;
        continue;
      }

      const ctx: ArchiveContextInput = {
        userId: row.createdByUserId,
        companyId: row.companyId,
        tenantId: row.tenantId,
        archiveModuleAccess: true,
      };

      const result = await archive.setItemDates(ctx, note.itemId, {
        dueAt: `${nextDueDate}T00:00:00.000Z`,
      });

      if (result.ok) {
        summary.itemsAdvanced += 1;
      } else {
        summary.itemsFailed += 1;
        console.error(`[archive-reminders] failed to advance item ${note.itemId} due date:`, result.error.message);
      }
    }
  }

  return summary;
}
