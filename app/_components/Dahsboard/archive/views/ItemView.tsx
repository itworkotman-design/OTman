import { useEffect, useState } from "react";
import Link from "next/link";
import type { ArchiveContentSectionType } from "@prisma/client";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ConditionBadge } from "@/app/_components/Dahsboard/archive/ConditionBadge";
import { CopyUrlButton } from "@/app/_components/Dahsboard/archive/CopyUrlButton";
import { ImagePreviewGrid } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { SettingsIcon, settingsIconButtonClass } from "@/app/_components/Dahsboard/archive/SettingsIcon";
import { TextFieldsReadOnly } from "@/app/_components/Dahsboard/archive/TextFieldsReadOnly";
import { SpreadsheetReadOnly } from "@/app/_components/Dahsboard/archive/SpreadsheetReadOnly";
import { TitleReadOnly } from "@/app/_components/Dahsboard/archive/TitleReadOnly";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveItemDetail = ArchiveItemSummary;

type ArchiveContentSectionRow = {
  id: string;
  type: ArchiveContentSectionType;
  position: number;
};

type ArchiveFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sectionId: string | null;
  description: string | null;
};

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function DownloadIcon() {
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

// Pure browsing view of a single item — read-only. Upload/delete/restore/
// status-and-date editing all live on this item's settings page instead.
// `codePath` is this item's own code (e.g. "1.2F.3F.5") split on "." — its
// last segment is the item's own number, every segment before that is its
// containing folder's path, one-to-one with `folderPath`'s entries.
export function ItemView({
  folderId,
  itemId,
  codePath,
}: {
  folderId: string;
  itemId: string;
  codePath: string[];
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

  const settingsHref = `/dashboard/archive/${codePath.join("/")}/settings`;

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {folderPath.map((entry, index) => {
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
          {canEdit && (
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

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {sections.map((section) => {
            const label = getContentSectionLabel(section.type, locale);
            const sectionFiles = files.filter((f) => f.sectionId === section.id);

            return (
              <div key={section.id}>
                {section.type === "FILES" && (
                  <h2 className="mb-3 flex items-center gap-2 font-semibold text-logoblue">
                    <ContentSectionTypeIcon type={section.type} className="h-5 w-5 shrink-0" />
                    {label.name}
                  </h2>
                )}

                {section.type === "TITLE" ? (
                  <TitleReadOnly sectionId={section.id} locale={locale} />
                ) : section.type === "TEXT_FIELDS" ? (
                  <TextFieldsReadOnly sectionId={section.id} locale={locale} />
                ) : section.type === "SPREADSHEET" ? (
                  <SpreadsheetReadOnly sectionId={section.id} locale={locale} />
                ) : section.type === "IMAGES" ? (
                  sectionFiles.length === 0 ? (
                    <div className="flex items-center justify-center rounded-[20px] border border-linePrimary px-5 py-8 text-sm text-textColorThird">
                      {locale === "nb" ? "Ingen bilder" : "No images"}
                    </div>
                  ) : (
                    <ImagePreviewGrid
                      images={sectionFiles.map((f) => ({
                        id: f.id,
                        src: `/api/archive/files/${f.id}/download`,
                        alt: f.originalFileName,
                        description: f.description,
                      }))}
                      gap={false}
                      uniformHeight
                    />
                  )
                ) : sectionFiles.length === 0 ? (
                  <div className="flex items-center justify-center rounded-[20px] border border-linePrimary px-5 py-8 text-sm text-textColorThird">
                    {locale === "nb" ? "Ingen filer" : "No files"}
                  </div>
                ) : (
                  <div className="rounded-[20px] pb-5 divide-y divide-lineSecondary">
                    {sectionFiles.map((file, fileIndex) => (
                      <div
                        key={file.id}
                        className="grid grid-cols-[2rem_minmax(0,200px)_1fr_auto_auto] items-center gap-4 py-3 px-2 hover:bg-linePrimary"
                      >
                        <span className="text-sm text-textColorThird">{fileIndex + 1}</span>
                        <a
                          href={`/api/archive/files/${file.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate text-logoblue"
                        >
                          {file.originalFileName}
                        </a>
                        <span className="min-w-0 truncate text-left text-sm text-textColorThird">{file.description}</span>
                        <span className="shrink-0 text-sm text-textColorThird">{formatBytes(file.sizeBytes)}</span>
                        <a
                          href={`/api/archive/files/${file.id}/download?download=1`}
                          download
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-logoblue transition-colors hover:bg-logoblue/10"
                          aria-label={locale === "nb" ? "Last ned" : "Download"}
                          title={locale === "nb" ? "Last ned" : "Download"}
                        >
                          <DownloadIcon />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
