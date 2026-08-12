"use client";

import { useState } from "react";
import type { ArchiveContentSectionType } from "@prisma/client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { ImagePreviewGrid } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";
import { TextFieldsPanel, type TextFieldsPanelHandle } from "@/app/_components/Dahsboard/archive/TextFieldsPanel";
import { SpreadsheetPanel, type SpreadsheetPanelHandle } from "@/app/_components/Dahsboard/archive/SpreadsheetPanel";
import { TitlePanel, type TitlePanelHandle } from "@/app/_components/Dahsboard/archive/TitlePanel";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";

// `key` is what dnd-kit/React reconciliation use — stable for a section's
// whole lifetime. `id` is the real, server-side id and is `null` for a
// pending section that Save hasn't created yet (see ContentSectionList's
// staging model). Keeping these separate means a pending section never
// remounts (and never loses staged text-field/spreadsheet/upload state) the
// moment Save resolves it to a real id.
export type ArchiveContentSectionRow = {
  key: string;
  id: string | null;
  type: ArchiveContentSectionType;
  position: number;
};

export type ArchiveContentFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sectionId: string | null;
  description: string | null;
};

// A file/image staged locally by the user but not yet uploaded — created the
// moment a file is picked, only actually sent to the server during Save's
// upload phase. `previewUrl` (an object URL) is only set for images.
// `description` is editable while still staged, and travels along in the
// same upload request once Save runs (see ContentSectionList's
// uploadFileXhr) — the description and the file itself land together in one
// request instead of a separate PATCH after the fact.
export type PendingUploadRow = {
  tempId: string;
  file: File;
  previewUrl?: string;
  description: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type Props = {
  section: ArchiveContentSectionRow;
  index: number;
  total: number;
  locale: string;
  files: ArchiveContentFileRow[];
  pendingUploads: PendingUploadRow[];
  onMove: (key: string, direction: "up" | "down") => void;
  onDelete: (key: string) => void;
  onStageUpload: (sectionKey: string, file: File) => void;
  onDiscardPendingUpload: (tempId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDescriptionChange: (fileId: string, description: string) => void;
  onStageDescriptionChange: (tempId: string, description: string) => void;
  textFieldsHandleRef?: (sectionKey: string, handle: TextFieldsPanelHandle | null) => void;
  onTextFieldsDirtyChange?: (sectionKey: string, dirty: boolean) => void;
  spreadsheetHandleRef?: (sectionKey: string, handle: SpreadsheetPanelHandle | null) => void;
  onSpreadsheetDirtyChange?: (sectionKey: string, dirty: boolean) => void;
  titleHandleRef?: (sectionKey: string, handle: TitlePanelHandle | null) => void;
  onTitleDirtyChange?: (sectionKey: string, dirty: boolean) => void;
};

export function ContentSectionCard({
  section,
  index,
  total,
  locale,
  files,
  pendingUploads,
  onMove,
  onDelete,
  onStageUpload,
  onDiscardPendingUpload,
  onDeleteFile,
  onDescriptionChange,
  onStageDescriptionChange,
  textFieldsHandleRef,
  onTextFieldsDirtyChange,
  spreadsheetHandleRef,
  onSpreadsheetDirtyChange,
  titleHandleRef,
  onTitleDirtyChange,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const label = getContentSectionLabel(section.type, locale);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.key });
  const style = { transform: CSS.Transform.toString(transform), transition };

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(section.key);
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
          {section.id === null && (
            <span className="rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-normal text-logoblue">
              {locale === "nb" ? "Ikke lagret" : "Unsaved"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={locale === "nb" ? "Flytt opp" : "Move up"}
            disabled={index === 0}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.key, "up")}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={locale === "nb" ? "Flytt ned" : "Move down"}
            disabled={index === total - 1}
            className="customButtonDefault !px-2 !py-1 text-xs"
            onClick={() => onMove(section.key, "down")}
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
        {section.type === "TITLE" ? (
          <TitlePanel
            ref={(handle) => titleHandleRef?.(section.key, handle)}
            sectionId={section.id}
            locale={locale}
            onDirtyChange={(dirty) => onTitleDirtyChange?.(section.key, dirty)}
          />
        ) : section.type === "TEXT_FIELDS" ? (
          <TextFieldsPanel
            ref={(handle) => textFieldsHandleRef?.(section.key, handle)}
            sectionId={section.id}
            locale={locale}
            onDirtyChange={(dirty) => onTextFieldsDirtyChange?.(section.key, dirty)}
          />
        ) : section.type === "SPREADSHEET" ? (
          <SpreadsheetPanel
            ref={(handle) => spreadsheetHandleRef?.(section.key, handle)}
            sectionId={section.id}
            locale={locale}
            onDirtyChange={(dirty) => onSpreadsheetDirtyChange?.(section.key, dirty)}
          />
        ) : section.type === "IMAGES" ? (
          <div>
            <ImagePreviewGrid
              images={files.map((f) => ({
                id: f.id,
                src: `/api/archive/files/${f.id}/download`,
                alt: f.originalFileName,
                description: f.description,
              }))}
              downloadable={false}
              onDeleteImage={onDeleteFile}
              onDescriptionChange={onDescriptionChange}
              leading={<AddImageTile locale={locale} onPick={(file) => onStageUpload(section.key, file)} />}
              trailing={pendingUploads.map((pending) => (
                <PendingImageTile
                  key={pending.tempId}
                  locale={locale}
                  pending={pending}
                  onDiscard={() => onDiscardPendingUpload(pending.tempId)}
                  onDescriptionChange={(value) => onStageDescriptionChange(pending.tempId, value)}
                />
              ))}
            />
          </div>
        ) : (
          <div>
            {(files.length > 0 || pendingUploads.length > 0) && (
              <div className="mb-3 flex flex-col gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col gap-2 rounded-xl border border-lineSecondary px-4 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
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
                      >
                        {locale === "nb" ? "Slett" : "Delete"}
                      </button>
                    </div>
                    <FileDescriptionInput
                      locale={locale}
                      description={file.description}
                      onChange={(value) => onDescriptionChange(file.id, value)}
                    />
                  </div>
                ))}
                {pendingUploads.map((pending) => (
                  <div
                    key={pending.tempId}
                    className="flex flex-col gap-2 rounded-xl border border-dashed border-logoblue/50 px-4 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-textColorSecond">{pending.file.name}</span>
                      <span className="rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-normal text-logoblue">
                        {locale === "nb" ? "Ikke lagret" : "Unsaved"}
                      </span>
                      <span className="text-textColorThird">{formatBytes(pending.file.size)}</span>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => onDiscardPendingUpload(pending.tempId)}
                      >
                        {locale === "nb" ? "Forkast" : "Discard"}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={pending.description}
                      onChange={(e) => onStageDescriptionChange(pending.tempId, e.target.value)}
                      placeholder={locale === "nb" ? "Legg til en beskrivelse..." : "Add a description..."}
                      className="customInput w-full !py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            <UploadControl locale={locale} onPick={(file) => onStageUpload(section.key, file)} />
          </div>
        )}
      </div>
    </div>
  );
}

// Sits as one more cell in ImagePreviewGrid's own auto-fit grid, same as
// AddImageTile — a locally-previewed image that hasn't been uploaded yet.
function PendingImageTile({
  locale,
  pending,
  onDiscard,
  onDescriptionChange,
}: {
  locale: string;
  pending: PendingUploadRow;
  onDiscard: () => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full max-w-56 self-start justify-self-start rounded-xl border-2 border-dashed border-logoblue/50 p-3">
      <div className="aspect-square w-full overflow-hidden">
        {pending.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pending.previewUrl} alt={pending.file.name} className="h-full w-full object-contain" />
        ) : null}
      </div>
      <p className="mt-2 truncate text-center text-sm text-textColorSecond">{pending.file.name}</p>
      <input
        type="text"
        value={pending.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={locale === "nb" ? "Legg til en beskrivelse..." : "Add a description..."}
        className="customInput mt-2 w-full !py-1 text-xs"
      />
      <span className="absolute left-2 top-2 rounded-full bg-logoblue/10 px-2 py-0.5 text-xs font-normal text-logoblue">
        {locale === "nb" ? "Ikke lagret" : "Unsaved"}
      </span>
      <button
        type="button"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-red-600 shadow hover:bg-red-50"
        aria-label={locale === "nb" ? "Forkast" : "Discard"}
        onClick={onDiscard}
      >
        ×
      </button>
    </div>
  );
}

// Picks a file and stages it (via onPick) — no upload happens here anymore;
// the actual XHR only runs during Save's upload phase (ContentSectionList).
function AddImageTile({ locale, onPick }: { locale: string; onPick: (file: File) => void }) {
  return (
    <label className="flex aspect-square w-full max-w-56 cursor-pointer flex-col items-center justify-center gap-2 self-start justify-self-start rounded-xl border-2 border-dashed border-lineSecondary p-3 text-textColorThird transition-colors hover:border-logoblue hover:bg-linePrimary/40 hover:text-logoblue">
      <span className="text-4xl font-light leading-none">+</span>
      <span className="text-sm font-medium">{locale === "nb" ? "Legg til bilde" : "Add image"}</span>
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          e.target.value = "";
          if (files) for (const file of Array.from(files)) onPick(file);
        }}
      />
    </label>
  );
}

// A single already-uploaded file's description, editable inline — fully
// controlled from ContentSectionList, which stages the edit locally
// (pendingDescriptions) and only PATCHes it during Save, same deferred model
// as everything else on this page. No local state/onBlur commit here: the
// parent needs every keystroke to keep its dirty flag (and the effective
// value shown here, via `files`) correct.
function FileDescriptionInput({
  locale,
  description,
  onChange,
}: {
  locale: string;
  description: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={description ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={locale === "nb" ? "Legg til en beskrivelse..." : "Add a description..."}
      className="customInput w-full !py-1.5 text-sm"
    />
  );
}

function UploadControl({ locale, accept, onPick }: { locale: string; accept?: string; onPick: (file: File) => void }) {
  return (
    <label className="customButtonDefault inline-block w-fit cursor-pointer">
      {locale === "nb" ? "Last opp fil" : "Upload file"}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}
