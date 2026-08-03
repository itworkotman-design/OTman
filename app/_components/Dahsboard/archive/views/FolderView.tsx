import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ArchiveSearchBar } from "@/app/_components/Dahsboard/archive/ArchiveSearchBar";
import { FolderPill } from "@/app/_components/Dahsboard/archive/FolderPill";
import { ItemPill } from "@/app/_components/Dahsboard/archive/ItemPill";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderDetail = ArchiveFolderSummary;
type ArchiveItemRow = ArchiveItemSummary;
type ArchiveChildFolderRow = ArchiveFolderSummary;

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

// Pure browsing view: no create/upload/delete/permissions controls here —
// every mutation lives on this folder's settings page or on an item's own
// settings page, matching the otman-archive prototype's view/settings split.
// `codePath` is this folder's own code (e.g. "1.2F.3F") split on "." — the
// exact URL segments that got us here, used to build every link on this
// page instead of the folder's opaque id.
export function FolderView({ folderId, codePath }: { folderId: string; codePath: string[] }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = !currentUser || getModuleAccess(currentUser, "ARCHIVE").enabled;

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

  // Status isn't shown or filterable here — this view only ever surfaces
  // active entries; anything else is managed (and made visible again) from
  // the folder's settings page.
  const activeChildFolders = childFolders.filter((childFolder) => childFolder.status === "active");
  const activeItems = items.filter((item) => item.status === "active");

  const settingsHref = `/dashboard/archive/${codePath.join("/")}/settings`;

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {folderPath.map((entry, index) => {
          if (!entry.hidden && entry.folderId === folderId) return null;
          const href = `/dashboard/archive/${codePath.slice(0, index + 1).join("/")}`;
          return (
            <span key={index} className="flex items-center gap-1">
              <span>/</span>
              {entry.hidden ? (
                <span>…</span>
              ) : (
                <Link href={href} className="hover:underline">
                  {entry.name ?? "…"}
                </Link>
              )}
            </span>
          );
        })}
        <span>/</span>
        <span className="font-medium text-textcolor">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </span>
      </nav>

      <div className="mb-8 flex w-full flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-logoblue lg:text-4xl">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </h1>
        {folder?.description && <p className="max-w-xl text-sm text-textColorThird">{folder.description}</p>}

        <Link href={settingsHref} className="customButtonDefault">
          {locale === "nb" ? "Innstillinger" : "Settings"}
        </Link>

        <div className="w-full max-w-[400]">
          <ArchiveSearchBar
            scopeFolderId={folderId}
            locale={locale}
            placeholder={locale === "nb" ? "Søk i denne mappen" : "Search this folder"}
          />
        </div>
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {activeChildFolders.length > 0 && (
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
              <p>{locale === "nb" ? "Sist endret" : "Updated"}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {activeChildFolders.map((childFolder) => (
              <FolderPill
                key={childFolder.id}
                folder={childFolder}
                href={`/dashboard/archive/${codeToUrlPath(childFolder.code)}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0 w-full overflow-x-auto">
        <div className="mb-3 flex items-end gap-4 font-semibold text-textColorThird">
          <h2 className="grow text-logoblue">{locale === "nb" ? "Elementer" : "Items"}</h2>
          <div className="w-full max-w-[100] text-center">
            <p>{locale === "nb" ? "Sist endret" : "Updated"}</p>
          </div>
        </div>
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster elementer..." : "Loading items..."}
          </div>
        ) : activeItems.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen elementer funnet" : "No items found"}
          </div>
        ) : (
          <div className="grid gap-3">
            {activeItems.map((item) => (
              <ItemPill
                key={item.id}
                item={item}
                href={`/dashboard/archive/${codeToUrlPath(item.code)}`}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
