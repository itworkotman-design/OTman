import { useEffect, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { EntitySettingsPanel } from "@/app/_components/Dahsboard/archive/EntitySettingsPanel";
import { ReminderSettingsPanel } from "@/app/_components/Dahsboard/archive/ReminderSettingsPanel";
import { ExpandablePanelList } from "@/app/_components/Dahsboard/archive/ExpandablePanelList";
import { ExcelPlaceholder } from "@/app/_components/Dahsboard/archive/ExcelPlaceholder";
import { ImagePreviewGrid } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";
import { formatReminderSubtitle } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveItemDetail = ArchiveItemSummary & {
  reminderDescription: string | null;
  reminderRecurrenceType: RecurrenceType | null;
  reminderRecurrenceConfig: unknown | null;
};

type ArchiveFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

type ArchiveRecoverableFileRow = {
  id: string;
  originalFileName: string;
  sizeBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Every mutation for this item lives here — status/dates, upload, delete,
// restore — matching the otman-archive prototype's EntrySettingsFields. The
// item view (`ItemView`) is pure browsing. `codePath` is this item's own
// code split on "." — used for the back link.
export function ItemSettingsView({ itemId, codePath }: { itemId: string; codePath: string[] }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled && archiveAccess.level === "ADMIN";

  const [item, setItem] = useState<ArchiveItemDetail | null>(null);
  const [files, setFiles] = useState<ArchiveFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowActionError, setRowActionError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [showDeletedFiles, setShowDeletedFiles] = useState(false);
  const [deletedFiles, setDeletedFiles] = useState<ArchiveRecoverableFileRow[]>([]);
  const [deletedFilesLoading, setDeletedFilesLoading] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

  async function loadItem() {
    try {
      setLoading(true);
      setError("");

      const [itemRes, filesRes] = await Promise.all([
        fetch(`/api/archive/items/${itemId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" }),
      ]);

      const itemData = await itemRes.json().catch(() => null);
      const filesData = await filesRes.json().catch(() => null);

      if (!itemRes.ok || !itemData?.ok) {
        setError(itemData?.reason || "Failed to load item");
        return;
      }

      setItem(itemData.item);

      if (filesRes.ok && filesData?.ok) {
        setFiles(filesData.files ?? []);
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
  }, [currentUser, hasAccess, itemId]);

  async function handleItemSettingsSaved() {
    setRowActionError("");
    await loadItem();
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);
    setUploaded(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await new Promise<{ ok: boolean; reason?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/archive/items/${itemId}/files`);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          try {
            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : { ok: false });
          } catch {
            resolve({ ok: false });
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });

      if (!data.ok) {
        setUploadError(data.reason || "Upload failed");
        return;
      }

      const filesRes = await fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" });
      const filesData = await filesRes.json().catch(() => null);
      if (filesRes.ok && filesData?.ok) setFiles(filesData.files ?? []);

      setUploaded(true);
      setTimeout(() => setUploaded(false), 2500);
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm(locale === "nb" ? "Slette denne filen?" : "Delete this file?")) return;

    try {
      setDeletingFileId(fileId);
      setRowActionError("");

      const res = await fetch(`/api/archive/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowActionError(data?.reason || "Failed to delete file");
        return;
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setRowActionError("Failed to delete file");
    } finally {
      setDeletingFileId(null);
    }
  }

  async function loadDeletedFiles() {
    try {
      setDeletedFilesLoading(true);

      const res = await fetch(`/api/archive/items/${itemId}/files/recoverable`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) return;

      setDeletedFiles(data.files ?? []);
    } finally {
      setDeletedFilesLoading(false);
    }
  }

  function handleToggleDeletedFiles() {
    const next = !showDeletedFiles;
    setShowDeletedFiles(next);
    if (next) void loadDeletedFiles();
  }

  async function handleRestoreFile(fileId: string) {
    try {
      setRestoringFileId(fileId);
      setRowActionError("");

      const res = await fetch(`/api/archive/files/${fileId}/restore`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRowActionError(data?.reason || "Failed to restore file");
        return;
      }

      await Promise.all([loadDeletedFiles(), loadItem()]);
    } catch {
      setRowActionError("Failed to restore file");
    } finally {
      setRestoringFileId(null);
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

  const imageFiles = files.filter((f) => f.mimeType.startsWith("image/"));
  const otherFiles = files.filter((f) => !f.mimeType.startsWith("image/"));

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link href={`/dashboard/archive/${codePath.join("/")}`} className="text-sm text-textColorThird hover:underline">
          ← {loading ? "..." : item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")}
        </Link>
      </div>

      <h1 className="mb-8 text-center text-2xl font-semibold text-logoblue lg:text-4xl">
        {loading
          ? "..."
          : `${item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")} ${locale === "nb" ? "innstillinger" : "Settings"}`}
      </h1>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {rowActionError && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {rowActionError}
        </div>
      )}

      {!loading && item && (
        <div className="flex flex-col gap-6">
          <div className="customContainer p-4">
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Detaljer" : "Details"}</h2>
            <EntitySettingsPanel
              kind="item"
              id={itemId}
              name={item.name}
              description={item.description}
              status={item.status}
              locale={locale}
              onSaved={() => void handleItemSettingsSaved()}
            />
          </div>

          <ExpandablePanelList
            items={[
              {
                id: "reminders",
                title: locale === "nb" ? "Påminnelser" : "Reminders",
                subtitle: formatReminderSubtitle(item.dueAt, item.reminderRecurrenceType, item.expiresAt, locale),
                content: (
                  <ReminderSettingsPanel
                    kind="item"
                    id={itemId}
                    dueAt={item.dueAt}
                    expiresAt={item.expiresAt}
                    reminderDescription={item.reminderDescription}
                    reminderRecurrenceType={item.reminderRecurrenceType}
                    reminderRecurrenceConfig={item.reminderRecurrenceConfig}
                    locale={locale}
                    onSaved={() => void handleItemSettingsSaved()}
                  />
                ),
              },
            ]}
          />

          <div className="customContainer p-4">
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Bilder" : "Images"}</h2>
            {imageFiles.length === 0 ? (
              <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen bilder" : "No images"}</p>
            ) : (
              <ImagePreviewGrid
                images={imageFiles.map((f) => ({
                  id: f.id,
                  src: `/api/archive/files/${f.id}/download`,
                  alt: f.originalFileName,
                }))}
                columns={5}
              />
            )}
          </div>

          <div className="customContainer p-4">
            <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Filer" : "Files"}</h2>
            {otherFiles.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {otherFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-lineSecondary px-4 py-2 text-sm">
                    <a
                      href={`/api/archive/files/${file.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-logoblue hover:underline"
                    >
                      {file.originalFileName}
                    </a>
                    <span className="text-textColorThird">{formatBytes(file.sizeBytes)}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => void handleDeleteFile(file.id)}
                      disabled={deletingFileId === file.id}
                    >
                      {locale === "nb" ? "Slett" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-2">
                <label className="customButtonDefault inline-block w-fit cursor-pointer">
                  {uploading
                    ? locale === "nb"
                      ? "Laster opp..."
                      : "Uploading..."
                    : locale === "nb"
                      ? "Last opp fil"
                      : "Upload file"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleUploadFile(file);
                    }}
                  />
                </label>

                {uploading && (
                  <div className="h-1.5 w-48 overflow-hidden rounded-full bg-linePrimary">
                    <div className="h-full rounded-full bg-logoblue transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                {uploaded && (
                  <p className="text-sm font-medium text-green-600">{locale === "nb" ? "✓ Lastet opp" : "✓ Uploaded"}</p>
                )}
              </div>

              <ExcelPlaceholder locale={locale} />
            </div>

            {uploadError && <p className="mt-2 text-sm font-medium text-red-600">{uploadError}</p>}

            <button
              type="button"
              className="mt-4 block text-sm text-textColorThird hover:underline"
              onClick={handleToggleDeletedFiles}
            >
              {showDeletedFiles
                ? locale === "nb"
                  ? "Skjul slettede filer"
                  : "Hide deleted files"
                : locale === "nb"
                  ? "Vis slettede filer"
                  : "Show deleted files"}
            </button>

            {showDeletedFiles && (
              <div className="mt-2 flex flex-col gap-1">
                {deletedFilesLoading ? (
                  <div className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</div>
                ) : deletedFiles.length === 0 ? (
                  <div className="text-sm text-textColorThird">
                    {locale === "nb" ? "Ingen slettede filer" : "No deleted files"}
                  </div>
                ) : (
                  deletedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-textColorThird">{file.originalFileName}</span>
                      <button
                        type="button"
                        className="text-logoblue hover:underline"
                        onClick={() => void handleRestoreFile(file.id)}
                        disabled={restoringFileId === file.id}
                      >
                        {locale === "nb" ? "Gjenopprett" : "Restore"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
