"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { canAccessArchive } from "@/lib/users/access";
import { ExpandablePanelList } from "@/app/_components/Dahsboard/archive/ExpandablePanelList";
import { FolderPill } from "@/app/_components/Dahsboard/archive/FolderPill";
import { ItemPill } from "@/app/_components/Dahsboard/archive/ItemPill";
import { STATUS_ORDER } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveBusinessStatus, ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderDetail = ArchiveFolderSummary;
type ArchiveItemRow = ArchiveItemSummary;
type ArchiveChildFolderRow = ArchiveFolderSummary;

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

const itemStatusLabel: Record<ArchiveBusinessStatus, { en: string; nb: string }> = {
  active: { en: "Active", nb: "Aktiv" },
  draft: { en: "Draft", nb: "Utkast" },
  inactive: { en: "Inactive", nb: "Inaktiv" },
  archived: { en: "Archived", nb: "Arkivert" },
};

// Pure browsing view: no create/upload/delete/permissions controls here —
// every mutation lives on this folder's settings page or on an item's own
// settings page, matching the otman-archive prototype's view/settings split.
export default function ArchiveFolderPage() {
  const params = useParams<{ folderId: string }>();
  const folderId = params.folderId;

  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = currentUser ? canAccessArchive(currentUser.role, currentUser.permissions) : true;

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [childFolders, setChildFolders] = useState<ArchiveChildFolderRow[]>([]);
  const [folderPath, setFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFolderAndItems() {
    try {
      setLoading(true);
      setError("");

      const [folderRes, itemsRes, childrenRes, pathRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/items`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/children`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/path`, { credentials: "include", cache: "no-store" }),
      ]);

      const folderData = await folderRes.json().catch(() => null);
      const itemsData = await itemsRes.json().catch(() => null);
      const childrenData = await childrenRes.json().catch(() => null);
      const pathData = await pathRes.json().catch(() => null);

      if (!folderRes.ok || !folderData?.ok) {
        setError(folderData?.reason || "Failed to load folder");
        return;
      }

      setFolder(folderData.folder);

      if (!itemsRes.ok || !itemsData?.ok) {
        setError(itemsData?.reason || "Failed to load items");
        return;
      }

      setItems(itemsData.items ?? []);

      if (childrenRes.ok && childrenData?.ok) {
        setChildFolders(childrenData.folders ?? []);
      }

      if (pathRes.ok && pathData?.ok) {
        setFolderPath(pathData.path ?? []);
      }
    } catch {
      setError("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!folderId) return;
    void loadFolderAndItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hasAccess, folderId]);

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  const itemGroups = STATUS_ORDER.map((status) => items.filter((item) => item.status === status)).filter(
    (group) => group.length > 0,
  );

  const itemAccordionItems = itemGroups.map((group) => {
    const status = group[0].status;
    const urgentCount = group.filter((item) => item.isOverdue || item.isExpired).length;

    return {
      id: status,
      title: itemStatusLabel[status][locale === "nb" ? "nb" : "en"],
      columns: [
        `${group.length} ${group.length === 1 ? (locale === "nb" ? "element" : "item") : locale === "nb" ? "elementer" : "items"}`,
        ...(urgentCount > 0 ? [locale === "nb" ? `${urgentCount} forfalt` : `${urgentCount} overdue`] : []),
      ],
      content: (
        <div className="grid gap-3">
          {group.map((item) => (
            <ItemPill key={item.id} item={item} href={`/dashboard/archive/${folderId}/items/${item.id}`} locale={locale} />
          ))}
        </div>
      ),
    };
  });

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {folderPath
          .filter((entry) => entry.hidden || entry.folderId !== folderId)
          .map((entry, index) => (
            <span key={index} className="flex items-center gap-1">
              <span>/</span>
              {entry.hidden ? (
                <span>…</span>
              ) : (
                <Link href={`/dashboard/archive/${entry.folderId}`} className="hover:underline">
                  {entry.name ?? "…"}
                </Link>
              )}
            </span>
          ))}
        <span>/</span>
        <span className="font-medium text-textcolor">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </span>
      </nav>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
          </h1>
          {folder?.description && <p className="mt-2 max-w-xl text-sm text-textColorThird">{folder.description}</p>}
        </div>

        <Link href={`/dashboard/archive/${folderId}/settings`} className="customButtonDefault">
          {locale === "nb" ? "Innstillinger" : "Settings"}
        </Link>
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {childFolders.length > 0 && (
        <div className="mb-6 min-w-0 w-full overflow-x-auto">
          <div className="mb-3 flex items-end gap-4 font-semibold text-textColorThird">
            <h2 className="grow text-logoblue">{locale === "nb" ? "Undermapper" : "Subfolders"}</h2>
            <div className="w-full max-w-[100] text-center">
              <p>{locale === "nb" ? "Elementer" : "Entries"}</p>
            </div>
            <div className="w-full max-w-[100] text-center">
              <p>{locale === "nb" ? "Brukere" : "Users"}</p>
            </div>
            <div className="w-full max-w-[100] text-center">
              <p>{locale === "nb" ? "Sist endret" : "Last modified"}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {childFolders.map((childFolder) => (
              <FolderPill key={childFolder.id} folder={childFolder} href={`/dashboard/archive/${childFolder.id}`} />
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0 w-full overflow-x-auto">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Elementer" : "Items"}</h2>
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster elementer..." : "Loading items..."}
          </div>
        ) : items.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen elementer funnet" : "No items found"}
          </div>
        ) : (
          <ExpandablePanelList items={itemAccordionItems} variant="logoblue" />
        )}
      </div>
    </div>
  );
}
