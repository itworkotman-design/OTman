import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ConditionBadge } from "@/app/_components/Dahsboard/archive/ConditionBadge";
import { CopyUrlButton } from "@/app/_components/Dahsboard/archive/CopyUrlButton";
import { SettingsIcon, settingsIconButtonClass } from "@/app/_components/Dahsboard/archive/SettingsIcon";
import { ItemContentSections } from "@/app/_components/Dahsboard/archive/ItemContentSections";
import type { ArchiveContentSectionRow, ArchiveFileRow } from "@/app/_components/Dahsboard/archive/ItemContentSections";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveItemDetail = ArchiveItemSummary;

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

// See the matching comment on FolderView's ArchiveLinkMode — same rationale:
// an item reached via "Shared with me" has no guaranteed ancestor access, so
// its breadcrumb/settings links can't be code-path-based.
type ArchiveLinkMode = { kind: "code" } | { kind: "sharedId" };

// Pure browsing view of a single item — read-only. Upload/delete/restore/
// status-and-date editing all live on this item's settings page instead.
// `codePath` is this item's own code (e.g. "1.2F.3F.5") split on "." — its
// last segment is the item's own number, every segment before that is its
// containing folder's path, one-to-one with `folderPath`'s entries.
export function ItemView({
  folderId,
  itemId,
  codePath,
  linkMode = { kind: "code" },
}: {
  folderId: string;
  itemId: string;
  codePath: string[];
  linkMode?: ArchiveLinkMode;
}) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : null;
  const hasAccess = !currentUser || archiveAccess!.enabled;
  const canEdit = archiveAccess?.level === "ADMIN";

  const [item, setItem] = useState<ArchiveItemDetail | null>(null);
  const [sections, setSections] = useState<ArchiveContentSectionRow[]>([]);
  const [files, setFiles] = useState<ArchiveFileRow[]>([]);
  const [folderPath, setFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [locatedInName, setLocatedInName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadItem() {
    try {
      setLoading(true);
      setError("");

      const [itemRes, sectionsRes, filesRes, pathRes] = await Promise.all([
        fetch(`/api/archive/items/${itemId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/items/${itemId}/content-sections`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/path`, { credentials: "include", cache: "no-store" }),
      ]);

      const itemData = await itemRes.json().catch(() => null);
      const sectionsData = await sectionsRes.json().catch(() => null);
      const filesData = await filesRes.json().catch(() => null);
      const pathData = await pathRes.json().catch(() => null);

      if (!itemRes.ok || !itemData?.ok) {
        setError(itemData?.reason || "Failed to load item");
        return;
      }

      setItem(itemData.item);

      // Best-effort "Located in" hint for the "Shared with me" entry point —
      // see the matching comment in FolderView.tsx.
      if (linkMode.kind === "sharedId") {
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.ok && data.folder?.name) setLocatedInName(data.folder.name);
          })
          .catch(() => {});

        // Best-effort "last opened" record for the archive root page's
        // "Shared with you" preview — see SharedWithYouSection.tsx.
        fetch("/api/archive/shared-with-me/recent", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityKind: "ITEM", entityId: itemId }),
        }).catch(() => {});
      }

      if (sectionsRes.ok && sectionsData?.ok) {
        setSections(sectionsData.sections ?? []);
      }

      if (filesRes.ok && filesData?.ok) {
        setFiles(filesData.files ?? []);
      }

      if (pathRes.ok && pathData?.ok) {
        setFolderPath(pathData.path ?? []);
      }
    } catch {
      setError("Failed to load item");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!itemId) return;
    void loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, folderId, itemId]);

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  const settingsHref = linkMode.kind === "code" ? `/dashboard/archive/${codePath.join("/")}/settings` : null;

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {linkMode.kind === "sharedId" ? (
          <span className="flex items-center gap-1">
            <span>/</span>
            <span>{locale === "nb" ? "Delt med deg" : "Shared with you"}</span>
            {locatedInName && (
              <span className="text-textColorThird">
                ({locale === "nb" ? "i" : "in"} {locatedInName})
              </span>
            )}
          </span>
        ) : (
          folderPath.map((entry, index) => {
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
          })
        )}
        <span>/</span>
        <span className="font-medium text-textcolor">
          {loading ? "..." : item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")}
        </span>
        <CopyUrlButton locale={locale} />
      </nav>

      <div className="mb-8 flex w-full flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-logoblue lg:text-4xl">
            {loading ? "..." : item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")}
            {item && <ConditionBadge flags={item} locale={locale} />}
          </h1>
          {canEdit && settingsHref && (
            <Link
              href={settingsHref}
              aria-label={locale === "nb" ? "Innstillinger" : "Settings"}
              title={locale === "nb" ? "Innstillinger" : "Settings"}
              className={settingsIconButtonClass}
            >
              <SettingsIcon />
            </Link>
          )}
        </div>
        {item?.description && <p className="max-w-xl text-sm text-textColorThird">{item.description}</p>}
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && <ItemContentSections sections={sections} files={files} locale={locale} />}
    </div>
  );
}
