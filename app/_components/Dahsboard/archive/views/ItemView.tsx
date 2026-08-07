import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ConditionBadge } from "@/app/_components/Dahsboard/archive/ConditionBadge";
import { ImagePreviewGrid } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveItemDetail = ArchiveItemSummary;

type ArchiveFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
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
  const hasAccess = !currentUser || getModuleAccess(currentUser, "ARCHIVE").enabled;

  const [item, setItem] = useState<ArchiveItemDetail | null>(null);
  const [files, setFiles] = useState<ArchiveFileRow[]>([]);
  const [folderPath, setFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadItem() {
    try {
      setLoading(true);
      setError("");

      const [itemRes, filesRes, pathRes] = await Promise.all([
        fetch(`/api/archive/items/${itemId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/path`, { credentials: "include", cache: "no-store" }),
      ]);

      const itemData = await itemRes.json().catch(() => null);
      const filesData = await filesRes.json().catch(() => null);
      const pathData = await pathRes.json().catch(() => null);

      if (!itemRes.ok || !itemData?.ok) {
        setError(itemData?.reason || "Failed to load item");
        return;
      }

      setItem(itemData.item);

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

  const imageFiles = files.filter((f) => f.mimeType.startsWith("image/"));
  const otherFiles = files.filter((f) => !f.mimeType.startsWith("image/"));
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
      </nav>

      <div className="mb-8 flex w-full flex-col items-center gap-3 text-center">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-logoblue lg:text-4xl">
          {loading ? "..." : item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")}
          {item && <ConditionBadge flags={item} locale={locale} />}
        </h1>
        {item?.description && <p className="max-w-xl text-sm text-textColorThird">{item.description}</p>}
        {item && <p className="text-sm text-textColorThird">{item.status}</p>}

        <Link href={settingsHref} className="customButtonDefault">
          {locale === "nb" ? "Innstillinger" : "Settings"}
        </Link>
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {imageFiles.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Bilder" : "Images"}</h2>
              <ImagePreviewGrid
                images={imageFiles.map((f) => ({
                  id: f.id,
                  src: `/api/archive/files/${f.id}/download`,
                  alt: f.originalFileName,
                }))}
                columns={5}
              />
            </div>
          )}

          <div>
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Filer" : "Files"}</h2>
            {otherFiles.length === 0 ? (
              <div className="customContainer flex items-center justify-center py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen filer" : "No files"}
              </div>
            ) : (
              <div className="customContainer divide-y divide-lineSecondary">
                {otherFiles.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/archive/files/${file.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 py-3 px-2 hover:bg-linePrimary"
                  >
                    <span className="min-w-0 flex-1 truncate text-logoblue">{file.originalFileName}</span>
                    <span className="shrink-0 text-sm text-textColorThird">{formatBytes(file.sizeBytes)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
