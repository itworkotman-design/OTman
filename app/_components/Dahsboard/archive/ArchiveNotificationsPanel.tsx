"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RecurrenceType } from "@prisma/client";
import { formatDisplayDate } from "@/lib/dateDisplay";
import { codeToUrlPath } from "./types";

type NotificationRow = {
  key: string;
  kind: "reminder" | "expiring";
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

const MAX_ROWS = 15;

const WEEKDAY_ABBR: Record<string, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  nb: ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"],
};

function formatRecurrenceBadge(type: RecurrenceType | null, config: unknown, locale: string): string | null {
  if (!type) return null;
  const abbr = WEEKDAY_ABBR[locale] ?? WEEKDAY_ABBR.en;
  const candidate = (config ?? {}) as Record<string, unknown>;

  if (type === "WEEKLY") {
    const weekdays = Array.isArray(candidate.weekdays) ? (candidate.weekdays as number[]) : [];
    if (weekdays.length === 0) return null;
    return weekdays
      .slice()
      .sort()
      .map((d) => abbr[d])
      .join(", ");
  }

  if (type === "MONTHLY") {
    const dayOfMonth = typeof candidate.dayOfMonth === "number" ? candidate.dayOfMonth : null;
    if (!dayOfMonth) return null;
    return locale === "nb" ? `den ${dayOfMonth}.` : `day ${dayOfMonth}`;
  }

  const dates = Array.isArray(candidate.dates) ? (candidate.dates as string[]) : [];
  if (dates.length === 0) return null;
  return `${dates.length} ${locale === "nb" ? "datoer" : "dates"}`;
}

// Merged view of the two "things that need attention" lists — due-date
// reminders (dueAt + recurrence) and expiring items (expiresAt) — into one
// table, per explicit user request to replace the old Folder/Item "Type"
// column with a Reminder/Expiring tag instead. That tag is the whole reason
// this is one merged, date-sorted table rather than two tabs: a per-row
// Reminder/Expiring label would be constant (and pointless) within a single
// already-labeled tab, but is genuinely informative once both kinds of rows
// are mixed together.
export function ArchiveNotificationsPanel({ locale, canRunNow = false }: { locale: string; canRunNow?: boolean }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningNow, setRunningNow] = useState(false);
  const [runNowError, setRunNowError] = useState("");

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
    void loadNotifications();
  }, [loadNotifications]);

  async function handleRunNow() {
    try {
      setRunningNow(true);
      setRunNowError("");

      const res = await fetch("/api/archive/reminders/generate-now", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRunNowError(data?.reason || "Failed to run reminder check");
        return;
      }

      await loadNotifications();
    } catch {
      setRunNowError("Failed to run reminder check");
    } finally {
      setRunningNow(false);
    }
  }

  return (
    <div>
      {canRunNow && (
        <div className="mb-3 flex items-center justify-end gap-3">
          <button
            type="button"
            className="customButtonDefault h-8 px-4 text-sm"
            onClick={() => void handleRunNow()}
            disabled={runningNow}
          >
            {runningNow
              ? locale === "nb"
                ? "Kjører..."
                : "Running..."
              : locale === "nb"
                ? "Kjør påminnelsessjekk nå"
                : "Run reminder check now"}
          </button>
        </div>
      )}

      {runNowError && <p className="mb-3 text-sm font-medium text-red-600">{runNowError}</p>}

      <div className="border border-logoblue rounded-4xl overflow-hidden">
        <table className="w-full">
          <thead className="text-logoblue">
            <tr className="h-10">
              <th className="border-r border-b min-w-[100] border-logoblue">{locale === "nb" ? "Type" : "Kind"}</th>
              <th className="border-r border-b min-w-[80] border-logoblue">{locale === "nb" ? "Kode" : "Code"}</th>
              <th className="border-r border-b min-w-[200] border-logoblue">{locale === "nb" ? "Navn" : "Name"}</th>
              <th className="border-r border-b min-w-[220] border-logoblue">{locale === "nb" ? "Beskrivelse" : "Description"}</th>
              <th className="border-b border-logoblue min-w-[120]">{locale === "nb" ? "Dato" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-textColorThird">
                  {locale === "nb" ? "Laster..." : "Loading..."}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-textColorThird">
                  {locale === "nb" ? "Ingenting å vise" : "Nothing to show"}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const recurrenceBadge = formatRecurrenceBadge(row.recurrenceType, row.recurrenceConfig, locale);
                return (
                  <tr key={row.key} className={index !== rows.length - 1 ? "border-b border-logoblue h-10" : "h-10"}>
                    <td className="border-r border-logoblue text-center text-sm text-textColorThird">
                      {row.kind === "reminder" ? (locale === "nb" ? "Påminnelse" : "Reminder") : locale === "nb" ? "Utløper" : "Expiring"}
                    </td>
                    <td className="border-r border-logoblue text-center text-sm font-semibold text-logoblue">{row.code}</td>
                    <td className="border-r border-logoblue pl-4">
                      <Link href={row.href} className="font-semibold text-logoblue hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="border-r border-logoblue pl-4 text-sm text-textColorThird">
                      {row.description ?? ""}
                      {recurrenceBadge && (
                        <span className="ml-2 rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-medium text-logoblue">
                          {recurrenceBadge}
                        </span>
                      )}
                    </td>
                    <td className={`pl-4 ${row.urgent ? "font-semibold text-red-500" : "text-logoblue"}`}>
                      {formatDisplayDate(row.date)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
