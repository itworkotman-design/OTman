import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ConditionBadge } from "@/app/_components/Dahsboard/archive/ConditionBadge";
import { CopyUrlButton } from "@/app/_components/Dahsboard/archive/CopyUrlButton";
import { ItemContentSections } from "@/app/_components/Dahsboard/archive/ItemContentSections";
import type { ArchiveContentSectionRow, ArchiveFileRow } from "@/app/_components/Dahsboard/archive/ItemContentSections";
import { ShortcutBadge } from "@/app/_components/Dahsboard/archive/ShortcutBadge";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

function GoToSourceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

// Read-only view of an item opened via a shortcut — see PillActions'
// "Go to source" action and EntityPill's corner-arrow badge for the other
// half of this feature. Unlike ItemView (whose breadcrumb always reflects
// the item's own REAL containing folder, fetched from
// /api/archive/folders/{folderId}/path), this fetches the TARGET folder's
// path instead, so navigating in from a shortcut shows the shortcut's own
// location — the item's real location is only ever reached deliberately,
// via the "Go to source" button. Content-section rendering is shared with
// ItemView via ItemContentSections; only the header/breadcrumb differ (see
// that file's own comment for why they weren't unified further).
export function ShortcutItemView({ shortcutId }: { shortcutId: string }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : null;
  const hasAccess = !currentUser || archiveAccess!.enabled;

  const [item, setItem] = useState<ArchiveItemSummary | null>(null);
  const [targetFolderCode, setTargetFolderCode] = useState<string | null>(null);
  const [targetFolderPath, setTargetFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [sections, setSections] = useState<ArchiveContentSectionRow[]>([]);
  const [files, setFiles] = useState<ArchiveFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!shortcutId) return;

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError("");

        const shortcutRes = await fetch(`/api/archive/shortcuts/${shortcutId}`, { credentials: "include", cache: "no-store" });
        const shortcutData = await shortcutRes.json().catch(() => null);
        if (cancelled) return;

        if (!shortcutRes.ok || !shortcutData?.ok) {
          setError(shortcutData?.reason || "Failed to load shortcut");
          return;
        }

        const loadedItem: ArchiveItemSummary = shortcutData.item;
        setItem(loadedItem);
        setTargetFolderCode(shortcutData.shortcut.targetFolderCode);

        const [pathRes, sectionsRes, filesRes] = await Promise.all([
          fetch(`/api/archive/folders/${shortcutData.shortcut.targetFolderId}/path`, { credentials: "include", cache: "no-store" }),
          fetch(`/api/archive/items/${loadedItem.id}/content-sections`, { credentials: "include", cache: "no-store" }),
          fetch(`/api/archive/items/${loadedItem.id}/files`, { credentials: "include", cache: "no-store" }),
        ]);
        const pathData = await pathRes.json().catch(() => null);
        const sectionsData = await sectionsRes.json().catch(() => null);
        const filesData = await filesRes.json().catch(() => null);
        if (cancelled) return;

        if (pathRes.ok && pathData?.ok) setTargetFolderPath(pathData.path ?? []);
        if (sectionsRes.ok && sectionsData?.ok) setSections(sectionsData.sections ?? []);
        if (filesRes.ok && filesData?.ok) setFiles(filesData.files ?? []);
      } catch {
        if (!cancelled) setError("Failed to load shortcut");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, shortcutId]);

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  const targetCodeSegments = targetFolderCode ? targetFolderCode.split(".") : [];
  const sourceHref = item ? `/dashboard/archive/${codeToUrlPath(item.code)}` : null;
  const goToSourceLabel = locale === "nb" ? "Gå til kilden" : "Go to source";

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {targetFolderPath.map((entry, index) => {
          const href = `/dashboard/archive/${targetCodeSegments.slice(0, index + 1).join("/")}`;
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
        <span className="flex items-center gap-1 font-medium text-textcolor">
          <ShortcutBadge className="h-3.5 w-3.5 text-logoblue" />
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
          {sourceHref && (
            <Link href={sourceHref} className="customButtonEnabled flex shrink-0 items-center gap-2 text-sm">
              <GoToSourceIcon />
              {goToSourceLabel}
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
