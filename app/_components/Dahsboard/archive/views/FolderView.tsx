import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ArchiveSearchBar } from "@/app/_components/Dahsboard/archive/ArchiveSearchBar";
import { CopyUrlButton } from "@/app/_components/Dahsboard/archive/CopyUrlButton";
import { FolderPill } from "@/app/_components/Dahsboard/archive/FolderPill";
import { ItemPill } from "@/app/_components/Dahsboard/archive/ItemPill";
import { codeBadgeWidthCh, codeToUrlPath, groupMixedBySection } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary, ArchiveSectionSummary } from "@/app/_components/Dahsboard/archive/types";

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
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : null;
  const hasAccess = !currentUser || archiveAccess!.enabled;
  const canEdit = archiveAccess?.level === "ADMIN";

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [childFolders, setChildFolders] = useState<ArchiveChildFolderRow[]>([]);
  const [sections, setSections] = useState<ArchiveSectionSummary[]>([]);
  const [folderPath, setFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFolderAndItems() {
    try {
      setLoading(true);
      setError("");

      const [folderRes, itemsRes, childrenRes, pathRes, sectionsRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/items`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/children`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/path`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/sections`, { credentials: "include", cache: "no-store" }),
      ]);

      const folderData = await folderRes.json().catch(() => null);
      const itemsData = await itemsRes.json().catch(() => null);
      const childrenData = await childrenRes.json().catch(() => null);
      const pathData = await pathRes.json().catch(() => null);
      const sectionsData = await sectionsRes.json().catch(() => null);

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

      if (sectionsRes.ok && sectionsData?.ok) {
        setSections(sectionsData.sections ?? []);
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
  }, [currentUser?.id, hasAccess, folderId]);

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
  const sectionGroups = groupMixedBySection(activeChildFolders, activeItems, sections, locale);
  const codeWidthCh = codeBadgeWidthCh([
    ...activeChildFolders.map((f) => f.code),
    ...activeItems.map((i) => i.code),
  ]);

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
        <CopyUrlButton locale={locale} />
      </nav>

      <div className="mb-8 flex w-full flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-logoblue lg:text-4xl">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </h1>
        {folder?.description && <p className="max-w-xl text-sm text-textColorThird">{folder.description}</p>}

        {canEdit && (
          <Link href={settingsHref} className="customButtonDefault">
            {locale === "nb" ? "Innstillinger" : "Settings"}
          </Link>
        )}

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

      {loading ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      ) : sectionGroups.length === 0 ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Ingen mapper eller elementer funnet" : "No folders or items found"}
        </div>
      ) : (
        <div className="grid gap-8">
          {sectionGroups.map((group) => (
            <div key={group.id} className="min-w-0 w-full overflow-x-auto">
              {group.name && <h2 className="mb-3 font-semibold text-logoblue">{group.name}</h2>}

              <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
                {group.folders.map((childFolder) => (
                  <FolderPill
                    key={childFolder.id}
                    folder={childFolder}
                    href={`/dashboard/archive/${codeToUrlPath(childFolder.code)}`}
                    locale={locale}
                    showStats={false}
                    canEdit={canEdit}
                    onChanged={loadFolderAndItems}
                    codeWidthCh={codeWidthCh}
                  />
                ))}
                {group.items.map((item) => (
                  <ItemPill
                    key={item.id}
                    item={item}
                    href={`/dashboard/archive/${codeToUrlPath(item.code)}`}
                    locale={locale}
                    canEdit={canEdit}
                    onChanged={loadFolderAndItems}
                    codeWidthCh={codeWidthCh}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
