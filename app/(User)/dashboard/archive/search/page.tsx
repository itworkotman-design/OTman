"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { canAccessArchive } from "@/lib/users/access";
import { bookingText } from "@/lib/booking/bookingUiText";

type ArchiveFolderResult = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type ArchiveItemResult = {
  id: string;
  folderId: string;
  name: string;
  description: string | null;
  status: string;
};

type FolderSearchResponse = {
  ok?: boolean;
  items?: ArchiveFolderResult[];
  nextCursor?: string | null;
  reason?: string;
};

type ItemSearchResponse = {
  ok?: boolean;
  items?: ArchiveItemResult[];
  nextCursor?: string | null;
  reason?: string;
};

const STATUS_OPTIONS = ["", "active", "inactive", "draft", "archived"] as const;

export default function ArchiveSearchPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = currentUser ? canAccessArchive(currentUser.role, currentUser.permissions) : true;

  const [nameContains, setNameContains] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [isDueSoon, setIsDueSoon] = useState(false);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [folders, setFolders] = useState<ArchiveFolderResult[]>([]);
  const [folderCursor, setFolderCursor] = useState<string | null>(null);
  const [loadingMoreFolders, setLoadingMoreFolders] = useState(false);

  const [items, setItems] = useState<ArchiveItemResult[]>([]);
  const [itemCursor, setItemCursor] = useState<string | null>(null);
  const [loadingMoreItems, setLoadingMoreItems] = useState(false);

  function buildParams(cursor?: string | null) {
    const params = new URLSearchParams();
    if (nameContains.trim()) params.set("nameContains", nameContains.trim());
    if (status) params.set("status", status);
    if (isOverdue) params.set("isOverdue", "true");
    if (isDueSoon) params.set("isDueSoon", "true");
    if (isExpiringSoon) params.set("isExpiringSoon", "true");
    if (isExpired) params.set("isExpired", "true");
    if (cursor) params.set("cursor", cursor);
    return params;
  }

  async function handleSearch() {
    try {
      setSearching(true);
      setError("");
      setHasSearched(true);

      const params = buildParams();

      const [folderRes, itemRes] = await Promise.all([
        fetch(`/api/archive/search/folders?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/archive/search/items?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const folderData = (await folderRes.json().catch(() => null)) as FolderSearchResponse | null;
      const itemData = (await itemRes.json().catch(() => null)) as ItemSearchResponse | null;

      if (!folderRes.ok || !folderData?.ok || !itemRes.ok || !itemData?.ok) {
        setError(folderData?.reason || itemData?.reason || "Search failed");
        setFolders([]);
        setItems([]);
        setFolderCursor(null);
        setItemCursor(null);
        return;
      }

      setFolders(folderData.items ?? []);
      setFolderCursor(folderData.nextCursor ?? null);
      setItems(itemData.items ?? []);
      setItemCursor(itemData.nextCursor ?? null);
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleLoadMoreFolders() {
    if (!folderCursor) return;
    try {
      setLoadingMoreFolders(true);
      const params = buildParams(folderCursor);
      const res = await fetch(`/api/archive/search/folders?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as FolderSearchResponse | null;
      if (!res.ok || !data?.ok) return;
      setFolders((prev) => [...prev, ...(data.items ?? [])]);
      setFolderCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMoreFolders(false);
    }
  }

  async function handleLoadMoreItems() {
    if (!itemCursor) return;
    try {
      setLoadingMoreItems(true);
      const params = buildParams(itemCursor);
      const res = await fetch(`/api/archive/search/items?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as ItemSearchResponse | null;
      if (!res.ok || !data?.ok) return;
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setItemCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMoreItems(false);
    }
  }

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            {bookingText(locale, "Archive")} — {locale === "nb" ? "Søk" : "Search"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-textColorThird">
            {locale === "nb"
              ? "Søk i mapper og elementer du har tilgang til."
              : "Search across folders and items you have access to."}
          </p>
        </div>

        <Link href="/dashboard/archive" className="text-sm text-textColorThird hover:underline">
          {locale === "nb" ? "Tilbake til arkiv" : "Back to archive"}
        </Link>
      </div>

      <div className="customContainer mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn inneholder" : "Name contains"}</label>
            <input
              className="customInput w-full"
              value={nameContains}
              onChange={(e) => setNameContains(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
              type="text"
              disabled={searching}
            />
          </div>

          <div className="min-w-[160]">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Status" : "Status"}</label>
            <select
              className="customInput w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
              disabled={searching}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "" ? (locale === "nb" ? "Alle" : "Any") : option}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleSearch()}
            disabled={searching}
          >
            {searching ? (locale === "nb" ? "Søker..." : "Searching...") : locale === "nb" ? "Søk" : "Search"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-textColorThird">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isOverdue} onChange={(e) => setIsOverdue(e.target.checked)} />
            {locale === "nb" ? "Forfalt" : "Overdue"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isDueSoon} onChange={(e) => setIsDueSoon(e.target.checked)} />
            {locale === "nb" ? "Forfaller snart" : "Due soon"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isExpiringSoon} onChange={(e) => setIsExpiringSoon(e.target.checked)} />
            {locale === "nb" ? "Utløper snart" : "Expiring soon"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isExpired} onChange={(e) => setIsExpired(e.target.checked)} />
            {locale === "nb" ? "Utløpt" : "Expired"}
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </div>

      {hasSearched && !error && (
        <div className="flex flex-col gap-6">
          <div className="min-w-0 w-full overflow-x-auto">
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Mapper" : "Folders"}</h2>
            {folders.length === 0 ? (
              <div className="customContainer flex items-center justify-center py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen mapper funnet" : "No folders found"}
              </div>
            ) : (
              <div className="customContainer divide-y divide-lineSecondary">
                {folders.map((folder) => (
                  <Link
                    key={folder.id}
                    href={`/dashboard/archive/${folder.id}`}
                    className="flex items-center justify-between gap-4 py-3 px-2 hover:bg-linePrimary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-textcolor">{folder.name}</div>
                      {folder.description && (
                        <div className="text-sm text-textColorThird">{folder.description}</div>
                      )}
                    </div>
                    <div className="text-sm text-textColorThird">{folder.status}</div>
                  </Link>
                ))}
              </div>
            )}
            {folderCursor && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  className="customButtonDefault"
                  onClick={() => void handleLoadMoreFolders()}
                  disabled={loadingMoreFolders}
                >
                  {loadingMoreFolders
                    ? locale === "nb"
                      ? "Laster..."
                      : "Loading..."
                    : locale === "nb"
                      ? "Last flere"
                      : "Load more"}
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0 w-full overflow-x-auto">
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Elementer" : "Items"}</h2>
            {items.length === 0 ? (
              <div className="customContainer flex items-center justify-center py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen elementer funnet" : "No items found"}
              </div>
            ) : (
              <div className="customContainer divide-y divide-lineSecondary">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/archive/${item.folderId}`}
                    className="flex items-center justify-between gap-4 py-3 px-2 hover:bg-linePrimary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-textcolor">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-textColorThird">{item.description}</div>
                      )}
                    </div>
                    <div className="text-sm text-textColorThird">{item.status}</div>
                  </Link>
                ))}
              </div>
            )}
            {itemCursor && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  className="customButtonDefault"
                  onClick={() => void handleLoadMoreItems()}
                  disabled={loadingMoreItems}
                >
                  {loadingMoreItems
                    ? locale === "nb"
                      ? "Laster..."
                      : "Loading..."
                    : locale === "nb"
                      ? "Last flere"
                      : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
