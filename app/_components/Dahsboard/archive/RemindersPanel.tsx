"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/dateDisplay";
import { codeToUrlPath } from "./types";

type ReminderRow = {
  key: string;
  kind: "folder" | "item";
  name: string;
  description: string | null;
  dueAt: string | null;
  href: string;
  urgent: boolean;
};

type FolderSearchApiResult = {
  ok?: boolean;
  items?: Array<{ id: string; name: string; description: string | null; dueAt?: string | null; code: string }>;
};

type ItemSearchApiResult = {
  ok?: boolean;
  items?: Array<{
    id: string;
    folderId: string;
    name: string;
    description: string | null;
    dueAt?: string | null;
    code: string;
  }>;
};

const MAX_ROWS = 10;

// Backed by the real dueAt/isDueSoon/isOverdue fields the search API already
// returns in full (confirmed by reading app/api/archive/search/*/route.ts —
// they spread the whole backend result) — not the otman-archive prototype's
// fake Reminder[] data.
export function RemindersPanel({ locale }: { locale: string }) {
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [overdueItemsRes, dueSoonItemsRes, overdueFoldersRes, dueSoonFoldersRes] = await Promise.all([
          fetch("/api/archive/search/items?isOverdue=true", { credentials: "include", cache: "no-store" }),
          fetch("/api/archive/search/items?isDueSoon=true", { credentials: "include", cache: "no-store" }),
          fetch("/api/archive/search/folders?isOverdue=true", { credentials: "include", cache: "no-store" }),
          fetch("/api/archive/search/folders?isDueSoon=true", { credentials: "include", cache: "no-store" }),
        ]);

        const [overdueItems, dueSoonItems, overdueFolders, dueSoonFolders] = await Promise.all([
          overdueItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
          dueSoonItemsRes.json().catch(() => null) as Promise<ItemSearchApiResult | null>,
          overdueFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
          dueSoonFoldersRes.json().catch(() => null) as Promise<FolderSearchApiResult | null>,
        ]);

        const combined: ReminderRow[] = [
          ...(overdueItems?.items ?? []).map((item) => ({
            key: `item-${item.id}`,
            kind: "item" as const,
            name: item.name,
            description: item.description,
            dueAt: item.dueAt ?? null,
            href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
            urgent: true,
          })),
          ...(dueSoonItems?.items ?? []).map((item) => ({
            key: `item-${item.id}`,
            kind: "item" as const,
            name: item.name,
            description: item.description,
            dueAt: item.dueAt ?? null,
            href: `/dashboard/archive/${codeToUrlPath(item.code)}`,
            urgent: false,
          })),
          ...(overdueFolders?.items ?? []).map((folder) => ({
            key: `folder-${folder.id}`,
            kind: "folder" as const,
            name: folder.name,
            description: folder.description,
            dueAt: folder.dueAt ?? null,
            href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
            urgent: true,
          })),
          ...(dueSoonFolders?.items ?? []).map((folder) => ({
            key: `folder-${folder.id}`,
            kind: "folder" as const,
            name: folder.name,
            description: folder.description,
            dueAt: folder.dueAt ?? null,
            href: `/dashboard/archive/${codeToUrlPath(folder.code)}`,
            urgent: false,
          })),
        ].sort((a, b) => {
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });

        if (!cancelled) setRows(combined.slice(0, MAX_ROWS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border border-logoblue rounded-4xl overflow-hidden">
      <table className="w-full">
        <thead className="text-logoblue">
          <tr className="h-10">
            <th className="border-r border-b min-w-[80] border-logoblue">{locale === "nb" ? "Type" : "Type"}</th>
            <th className="border-r border-b min-w-[300] border-logoblue">{locale === "nb" ? "Navn" : "Name"}</th>
            <th className="border-b border-logoblue min-w-[120]">{locale === "nb" ? "Dato" : "Date"}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-sm text-textColorThird">
                {locale === "nb" ? "Laster..." : "Loading..."}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-sm text-textColorThird">
                {locale === "nb" ? "Ingen påminnelser" : "No reminders"}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.key} className={index !== rows.length - 1 ? "border-b border-logoblue h-10" : "h-10"}>
                <td className="border-r border-logoblue text-center text-sm text-textColorThird">
                  {row.kind === "folder" ? (locale === "nb" ? "Mappe" : "Folder") : locale === "nb" ? "Element" : "Item"}
                </td>
                <td className="border-r border-logoblue pl-4">
                  <Link href={row.href} className="font-semibold text-logoblue hover:underline">
                    {row.name}
                  </Link>
                  {row.description && <span className="ml-2 text-sm text-textColorThird">{row.description}</span>}
                </td>
                <td className={`pl-4 ${row.urgent ? "font-semibold text-red-500" : "text-logoblue"}`}>
                  {formatDisplayDate(row.dueAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
