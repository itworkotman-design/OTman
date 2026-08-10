"use client";

import { useState } from "react";
import type { ArchiveContentSectionType } from "@prisma/client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { ImagePreviewGrid } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";
import { TextFieldsPanel, type TextFieldsPanelHandle } from "@/app/_components/Dahsboard/archive/TextFieldsPanel";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";

export type ArchiveContentSectionRow = {
  id: string;
  type: ArchiveContentSectionType;
  position: number;
};

export type ArchiveContentFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sectionId: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type UploadState = { uploading: boolean; progress: number; uploaded: boolean; error: string };

type Props = {
  section: ArchiveContentSectionRow;
  index: number;
  total: number;
  locale: string;
  files: ArchiveContentFileRow[];
  uploadState?: UploadState;
  deletingFileId: string | null;
  onMove: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
  onUploadFile: (sectionId: string, file: File) => void;
  onDeleteFile: (fileId: string) => void;
  textFieldsHandleRef?: (sectionId: string, handle: TextFieldsPanelHandle | null) => void;
  onTextFieldsDirtyChange?: (sectionId: string, dirty: boolean) => void;
};

export function ContentSectionCard({
  section,
  index,
  total,
  locale,
  files,
  uploadState,
  deletingFileId,
  onMove,
  onDelete,
  onUploadFile,
  onDeleteFile,
  textFieldsHandleRef,
  onTextFieldsDirtyChange,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const label = getContentSectionLabel(section.type, locale);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(section.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`customContainer p-0 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 border-b border-lineSecondary p-2">
        <button
          type="button"
          aria-label={locale === "nb" ? "Dra for å endre rekkefølge" : "Drag to reorder"}
          className="cursor-grab px-1 text-textColorSecond"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        <div className="flex flex-1 items-center gap-2 px-2 py-2">
          <ContentSectionTypeIcon type={section.type} className="h-5 w-5 shrink-0 text-logoblue" />
          <span className="font-semibold text-logoblue">{label.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={locale === "nb" ? "Flytt opp" : "Move up"}
            disabled={index === 0}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.id, "up")}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={locale === "nb" ? "Flytt ned" : "Move down"}
            disabled={index === total - 1}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.id, "down")}
          >
            ↓
          </button>
          <button
            type="button"
            className={`customButtonDefault !px-2 !py-1 text-xs ${confirmingDelete ? "bg-red-100 text-red-700" : ""}`}
            onClick={handleDeleteClick}
          >
            {confirmingDelete ? (locale === "nb" ? "Bekreft sletting" : "Confirm delete") : locale === "nb" ? "Slett" : "Delete"}
          </button>
          {confirmingDelete ? (
            <button
              type="button"
              className="customButtonDefault !px-2 !py-1 text-xs"
              onClick={() => setConfirmingDelete(false)}
            >
              {locale === "nb" ? "Avbryt" : "Cancel"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        {section.type === "TEXT_FIELDS" ? (
          <TextFieldsPanel
            ref={(handle) => textFieldsHandleRef?.(section.id, handle)}
            sectionId={section.id}
            locale={locale}
            onDirtyChange={(dirty) => onTextFieldsDirtyChange?.(section.id, dirty)}
          />
        ) : section.type === "IMAGES" ? (
          <div>
            <ImagePreviewGrid
              images={files.map((f) => ({
                id: f.id,
                src: `/api/archive/files/${f.id}/download`,
                alt: f.originalFileName,
              }))}
              trailing={
                <AddImageTile
                  locale={locale}
                  uploadState={uploadState}
                  onUpload={(file) => onUploadFile(section.id, file)}
                />
              }
            />
            {uploadState?.error && <p className="mt-2 text-sm font-medium text-red-600">{uploadState.error}</p>}
          </div>
        ) : (
          <div>
            {files.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-lineSecondary px-4 py-2 text-sm"
                  >
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
                      onClick={() => onDeleteFile(file.id)}
                      disabled={deletingFileId === file.id}
                    >
                      {locale === "nb" ? "Slett" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <UploadControl locale={locale} uploadState={uploadState} onUpload={(file) => onUploadFile(section.id, file)} />
          </div>
        )}
      </div>
    </div>
  );
}

// Sits as the last cell in ImagePreviewGrid's own auto-fit grid (via its
// `trailing` prop) rather than a separate button below the grid — a square
// dashed-border "+" tile that takes up exactly the next grid column,
// hoverable like the image cells beside it. `self-start`/capped width keep
// it a compact square instead of stretching to a whole (possibly huge)
// grid row when it's the only cell — see ImagePreviewGrid's per-count
// auto-fit sizing comment.
function AddImageTile({
  locale,
  uploadState,
  onUpload,
}: {
  locale: string;
  uploadState?: UploadState;
  onUpload: (file: File) => void;
}) {
  const uploading = uploadState?.uploading ?? false;

  return (
    <label
      className={`flex aspect-square w-full max-w-56 cursor-pointer flex-col items-center justify-center gap-2 self-start justify-self-start rounded-xl border-2 border-dashed border-lineSecondary p-3 text-textColorThird transition-colors hover:border-logoblue hover:bg-linePrimary/40 hover:text-logoblue ${uploading ? "pointer-events-none opacity-70" : ""}`}
    >
      {uploading ? (
        <>
          <span className="text-sm font-medium">{locale === "nb" ? "Laster opp..." : "Uploading..."}</span>
          <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-linePrimary">
            <div
              className="h-full rounded-full bg-logoblue transition-all"
              style={{ width: `${uploadState?.progress ?? 0}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <span className="text-4xl font-light leading-none">+</span>
          <span className="text-sm font-medium">{locale === "nb" ? "Legg til bilde" : "Add image"}</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />
    </label>
  );
}

function UploadControl({
  locale,
  accept,
  uploadState,
  onUpload,
}: {
  locale: string;
  accept?: string;
  uploadState?: UploadState;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="customButtonDefault inline-block w-fit cursor-pointer">
        {uploadState?.uploading
          ? locale === "nb"
            ? "Laster opp..."
            : "Uploading..."
          : locale === "nb"
            ? "Last opp fil"
            : "Upload file"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={uploadState?.uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </label>

      {uploadState?.uploading && (
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-linePrimary">
          <div className="h-full rounded-full bg-logoblue transition-all" style={{ width: `${uploadState.progress}%` }} />
        </div>
      )}

      {uploadState?.uploaded && (
        <p className="text-sm font-medium text-green-600">{locale === "nb" ? "✓ Lastet opp" : "✓ Uploaded"}</p>
      )}

      {uploadState?.error && <p className="text-sm font-medium text-red-600">{uploadState.error}</p>}
    </div>
  );
}
