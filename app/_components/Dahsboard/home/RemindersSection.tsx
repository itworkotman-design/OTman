"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RecurrenceType } from "@prisma/client";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { getModuleAccess } from "@/lib/users/access";
import { formatDisplayDate } from "@/lib/dateDisplay";
import { addDaysIso, getOsloDateKey } from "@/lib/dates/isoDate";
import { findNextRecurrenceDate } from "@/lib/orders/recurringOrders/occurrenceDates";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";

const SNOOZE_DAYS = 7;
const MAX_ROWS = 10;

type NotificationRow = {
  key: string;
  kind: "reminder" | "expiring";
  entityKind: "item" | "folder";
  entityId: string;
  code: string;
  name: string;
  description: string | null;
  recurrenceType: RecurrenceType | null;
  recurrenceConfig: unknown | null;
  date: string | null;
  href: string;
  urgent: boolean;
};

type FolderSearchApiResult = {
  ok?: boolean;
  items?: Array<{
    id: string;
    name: string;
    description: string | null;
    reminderDescription: string | null;
    reminderRecurrenceType: RecurrenceType | null;
    reminderRecurrenceConfig: unknown | null;
    dueAt?: string | null;
    expiresAt?: string | null;
    code: string;
  }>;
};

type ItemSearchApiResult = {
  ok?: boolean;
  items?: Array<{
    id: string;
    folderId: string;
    name: string;
    description: string | null;
    reminderDescription: string | null;
    reminderRecurrenceType: RecurrenceType | null;
    reminderRecurrenceConfig: unknown | null;
    dueAt?: string | null;
    expiresAt?: string | null;
    code: string;
  }>;
};

// Same merged "things that need attention" list previously shown on the
// archive homepage (ArchiveNotificationsPanel, now removed) — moved here per
// explicit user request, restyled to match DashboardHome's card/row language
// instead of the archive section's bordered-table look. Only rendered for
// members with ARCHIVE module access at ADMIN level (mirrors the archive
// root page's isArchiveAdmin gate) since the accept/snooze actions PATCH
// archive endpoints that require that same level.
export function RemindersSection() {
  const currentUser = useCurrentUser();
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : null;
  const canManage = archiveAccess?.enabled && archiveAccess.level === "ADMIN";

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const [
        overdueItemsRes,
        dueSoonItemsRes,
        overdueFoldersRes,
        dueSoonFoldersRes,
        expiredItemsRes,
        expiringSoonItemsRes,
        expiredFoldersRes,
        expiringSoonFoldersRes,
      ] = await Promise.all([
        fetch("/api/archive/search/items?isOverdue=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/items?isDueSoon=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/folders?isOverdue=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/folders?isDueSoon=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/items?isExpired=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/items?isExpiringSoon=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/folders?isExpired=true", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/search/folders?isExpiringSoon=true", { credentials: "include", cache: "no-store" }),
      ]);

      const [
        overdueItems,
        dueSoonItems,
        overdueFolders,
        dueSoonFolders,
        expiredItems,
        expiringSoonItems,
        expiredFolders,
        expiringSoonFolders,
      ] = await Promise.all([
        overdueItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
        dueSoonItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
        overdueFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
        dueSoonFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
        expiredItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
        expiringSoonItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
        expiredFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
        expiringSoonFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
      ]);

      const combined: NotificationRow[] = [
        ...(overdueItems?.items ?? []).map((item) => ({
          key: `reminder-item-${item.id}`,
          kind: "reminder" as const,
          entityKind: "item" as const,
          entityId: item.id,
          code: item.code,
          name: item.name,
          description: item.reminderDescription,
          recurrenceType: item.reminderRecurrenceType,
          recurrenceConfig: item.reminderRecurrenceConfig,
          date: item.dueAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
          urgent: true,
        })),
        ...(dueSoonItems?.items ?? []).map((item) => ({
          key: `reminder-item-${item.id}`,
          kind: "reminder" as const,
          entityKind: "item" as const,
          entityId: item.id,
          code: item.code,
          name: item.name,
          description: item.reminderDescription,
          recurrenceType: item.reminderRecurrenceType,
          recurrenceConfig: item.reminderRecurrenceConfig,
          date: item.dueAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
          urgent: false,
        })),
        ...(overdueFolders?.items ?? []).map((folder) => ({
          key: `reminder-folder-${folder.id}`,
          kind: "reminder" as const,
          entityKind: "folder" as const,
          entityId: folder.id,
          code: folder.code,
          name: folder.name,
          description: folder.reminderDescription,
          recurrenceType: folder.reminderRecurrenceType,
          recurrenceConfig: folder.reminderRecurrenceConfig,
          date: folder.dueAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
          urgent: true,
        })),
        ...(dueSoonFolders?.items ?? []).map((folder) => ({
          key: `reminder-folder-${folder.id}`,
          kind: "reminder" as const,
          entityKind: "folder" as const,
          entityId: folder.id,
          code: folder.code,
          name: folder.name,
          description: folder.reminderDescription,
          recurrenceType: folder.reminderRecurrenceType,
          recurrenceConfig: folder.reminderRecurrenceConfig,
          date: folder.dueAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
          urgent: false,
        })),
        ...(expiredItems?.items ?? []).map((item) => ({
          key: `expiring-item-${item.id}`,
          kind: "expiring" as const,
          entityKind: "item" as const,
          entityId: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          recurrenceType: null,
          recurrenceConfig: null,
          date: item.expiresAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
          urgent: true,
        })),
        ...(expiringSoonItems?.items ?? []).map((item) => ({
          key: `expiring-item-${item.id}`,
          kind: "expiring" as const,
          entityKind: "item" as const,
          entityId: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          recurrenceType: null,
          recurrenceConfig: null,
          date: item.expiresAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
          urgent: false,
        })),
        ...(expiredFolders?.items ?? []).map((folder) => ({
          key: `expiring-folder-${folder.id}`,
          kind: "expiring" as const,
          entityKind: "folder" as const,
          entityId: folder.id,
          code: folder.code,
          name: folder.name,
          description: folder.description,
          recurrenceType: null,
          recurrenceConfig: null,
          date: folder.expiresAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
          urgent: true,
        })),
        ...(expiringSoonFolders?.items ?? []).map((folder) => ({
          key: `expiring-folder-${folder.id}`,
          kind: "expiring" as const,
          entityKind: "folder" as const,
          entityId: folder.id,
          code: folder.code,
          name: folder.name,
          description: folder.description,
          recurrenceType: null,
          recurrenceConfig: null,
          date: folder.expiresAt ?? null,
          href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
          urgent: false,
        })),
      ].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setRows(combined.slice(0, MAX_ROWS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void loadNotifications();
  }, [canManage, loadNotifications]);

  // Accept/Snooze both PATCH the same archive /dates endpoint the archive
  // settings' ReminderSettingsPanel Save/Clear actions use. Accept: for a
  // recurring reminder, rolls dueAt to its next occurrence (the same "this
  // instance is done" advance the cron in lib/docArchive/reminderRecurrence.ts
  // performs); for a one-time reminder or any expiring row (no recurrence
  // concept) it just clears the date. Snooze never touches the recurrence
  // rule — it only pushes the relevant date SNOOZE_DAYS forward.
  async function patchDate(row: NotificationRow, field: "dueAt" | "expiresAt", value: string | null) {
    const basePath = row.entityKind === "item" ? `/api/archive/items/${row.entityId}` : `/api/archive/folders/${row.entityId}`;
    const res = await fetch(`${basePath}/dates`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.reason || "Failed to update");
  }

  async function runRowAction(row: NotificationRow, action: "accept" | "snooze") {
    try {
      setActingKey(row.key);
      setActionError("");

      const field: "dueAt" | "expiresAt" = row.kind === "reminder" ? "dueAt" : "expiresAt";

      if (action === "accept") {
        if (row.kind === "reminder" && row.recurrenceType) {
          const tomorrow = addDaysIso(getOsloDateKey(), 1);
          const nextDate = findNextRecurrenceDate(row.recurrenceType, row.recurrenceConfig, tomorrow);
          await patchDate(row, field, nextDate ? `${nextDate}T00:00:00.000Z` : null);
        } else {
          await patchDate(row, field, null);
        }
      } else {
        const fromDate = row.date ? getOsloDateKey(new Date(row.date)) : getOsloDateKey();
        const snoozedDate = addDaysIso(fromDate, SNOOZE_DAYS);
        await patchDate(row, field, `${snoozedDate}T00:00:00.000Z`);
      }

      await loadNotifications();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActingKey(null);
    }
  }

  if (!canManage) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-logoblue">Reminders</h2>

        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
          {rows.length} needing attention
        </span>
      </div>

      <div className="p-6">
        {actionError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Nothing to show.</div>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-logoblue">{row.code}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        row.kind === "reminder" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${row.kind === "reminder" ? "bg-blue-500" : "bg-orange-500"}`} />
                      {row.kind === "reminder" ? "Reminder" : "Expiring"}
                    </span>
                    <span className={`text-sm font-medium ${row.urgent ? "text-red-600" : "text-slate-500"}`}>{formatDisplayDate(row.date)}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <Link href={row.href} className="truncate text-base font-semibold text-slate-800 hover:text-logoblue">
                      {row.name}
                    </Link>
                    {row.description && <span className="truncate text-sm text-slate-500">{row.description}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runRowAction(row, "accept")}
                    disabled={actingKey === row.key}
                    title={row.kind === "reminder" && row.recurrenceType ? "Mark done and advance to the next occurrence" : "Mark done"}
                    aria-label="Mark done"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-logoblue transition-all duration-150 hover:bg-logoblue/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => void runRowAction(row, "snooze")}
                    disabled={actingKey === row.key}
                    title={`Snooze ${SNOOZE_DAYS} days`}
                    aria-label={`Snooze ${SNOOZE_DAYS} days`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-logoblue transition-all duration-150 hover:bg-logoblue/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100"
                  >
                    <SnoozeIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Same checkmark glyph used by the old archive-page action column (before
// the reminders block moved here) — icon-only with a native `title` tooltip,
// matching SnoozeIcon's treatment right next to it.
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Same clock glyph used by the old archive-page action column (before the
// reminders block moved here) — kept icon-only with a native `title` tooltip
// rather than a labeled button.
function SnoozeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M9 2h6" />
    </svg>
  );
}
