"use client";

import { useEffect, useRef, useState } from "react";
import type { ArchiveContentSectionType } from "@prisma/client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  ContentSectionCard,
  type ArchiveContentFileRow,
  type ArchiveContentSectionRow,
} from "@/app/_components/Dahsboard/archive/ContentSectionCard";
import { ContentSectionPicker } from "@/app/_components/Dahsboard/archive/ContentSectionPicker";
import type { TextFieldsPanelHandle } from "@/app/_components/Dahsboard/archive/TextFieldsPanel";

type ArchiveRecoverableFileRow = {
  id: string;
  originalFileName: string;
  sizeBytes: number;
};

type UploadState = { uploading: boolean; progress: number; uploaded: boolean; error: string };

type Props = {
  itemId: string;
  locale: string;
};

// The item settings page's "Content" area — a reorderable, addable list of
// Images/Files/Text-fields sections, mirroring website/BlogSectionList.tsx's
// drag+button reorder / add-section-picker / persist-on-every-move pattern.
// Owns all file upload/delete/restore state (moved here wholesale from the
// old fixed-layout ItemSettingsView) since every upload now targets one
// specific section instance rather than one shared item-wide bucket.
export function ContentSectionList({ itemId, locale }: Props) {
  const [sections, setSections] = useState<ArchiveContentSectionRow[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [files, setFiles] = useState<ArchiveContentFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Per-section Text-fields handles/dirty flags, keyed by sectionId — lets
  // the page-level Save button below flush every section's pending new
  // fields (see TextFieldsPanel's flushPendingAdds) without those panels
  // lifting their whole field list up here.
  const textFieldsHandles = useRef(new Map<string, TextFieldsPanelHandle>());
  const [textFieldsDirty, setTextFieldsDirty] = useState<Record<string, boolean>>({});

  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [showDeletedFiles, setShowDeletedFiles] = useState(false);
  const [deletedFiles, setDeletedFiles] = useState<ArchiveRecoverableFileRow[]>([]);
  const [deletedFilesLoading, setDeletedFilesLoading] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [sectionsRes, filesRes] = await Promise.all([
        fetch(`/api/archive/items/${itemId}/content-sections`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" }),
      ]);

      const sectionsData = await sectionsRes.json().catch(() => null);
      const filesData = await filesRes.json().catch(() => null);

      if (!sectionsRes.ok || !sectionsData?.ok) {
        setError(sectionsData?.reason || "Failed to load content sections");
        return;
      }

      const loadedSections: ArchiveContentSectionRow[] = sectionsData.sections ?? [];
      setSections(loadedSections);
      setSavedOrder(loadedSections.map((s) => s.id));
      if (filesRes.ok && filesData?.ok) setFiles(filesData.files ?? []);
    } catch {
      setError("Failed to load content sections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Reordering (button or drag) only updates local state — it's staged, not
  // persisted, until the big Save button below is clicked, per explicit user
  // request that this mirror Details/Reminders' "only show Save once
  // something changed" behavior instead of website/BlogSectionList.tsx's
  // persist-on-every-move. Same button also flushes any pending (unsaved)
  // new text fields staged in this item's Text-fields section(s) — per
  // explicit follow-up request that adding a field is saved by this button,
  // not the small "Add" button inside the section itself.
  const orderDirty = sections.length !== savedOrder.length || sections.some((s, i) => s.id !== savedOrder[i]);
  const anyTextFieldsDirty = Object.values(textFieldsDirty).some(Boolean);
  const dirty = orderDirty || anyTextFieldsDirty;

  function registerTextFieldsHandle(sectionId: string, handle: TextFieldsPanelHandle | null) {
    if (handle) textFieldsHandles.current.set(sectionId, handle);
    else textFieldsHandles.current.delete(sectionId);
  }

  function handleTextFieldsDirtyChange(sectionId: string, sectionDirty: boolean) {
    setTextFieldsDirty((prev) => (prev[sectionId] === sectionDirty ? prev : { ...prev, [sectionId]: sectionDirty }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      await Promise.all([...textFieldsHandles.current.values()].map((handle) => handle.flushPendingAdds()));

      if (orderDirty) {
        const orderedIds = sections.map((s) => s.id);
        const res = await fetch(`/api/archive/items/${itemId}/content-sections/reorder`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderedIds.map((id, position) => ({ id, position }))),
        });

        if (!res.ok) {
          setError("Failed to save section order");
          return;
        }

        setSavedOrder(orderedIds);
      }
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleMove(id: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    setSections(arrayMove(sections, index, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    setSections(arrayMove(sections, oldIndex, newIndex));
  }

  async function handleAddSection(type: ArchiveContentSectionType) {
    const res = await fetch(`/api/archive/items/${itemId}/content-sections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      setSections((prev) => [...prev, data.section]);
      setSavedOrder((prev) => [...prev, data.section.id]);
    }
  }

  async function handleDeleteSection(id: string) {
    const res = await fetch(`/api/archive/content-sections/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== id));
      textFieldsHandles.current.delete(id);
      setTextFieldsDirty((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      void load();
    }
  }

  async function handleUploadFile(sectionId: string, file: File) {
    setUploadStates((prev) => ({ ...prev, [sectionId]: { uploading: true, progress: 0, uploaded: false, error: "" } }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sectionId", sectionId);

    try {
      const data = await new Promise<{ ok: boolean; reason?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/archive/items/${itemId}/files`);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadStates((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], uploading: true, progress, uploaded: false, error: "" } }));
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
        setUploadStates((prev) => ({ ...prev, [sectionId]: { uploading: false, progress: 0, uploaded: false, error: data.reason || "Upload failed" } }));
        return;
      }

      const filesRes = await fetch(`/api/archive/items/${itemId}/files`, { credentials: "include", cache: "no-store" });
      const filesData = await filesRes.json().catch(() => null);
      if (filesRes.ok && filesData?.ok) setFiles(filesData.files ?? []);

      setUploadStates((prev) => ({ ...prev, [sectionId]: { uploading: false, progress: 0, uploaded: true, error: "" } }));
      setTimeout(() => {
        setUploadStates((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], uploaded: false } }));
      }, 2500);
    } catch {
      setUploadStates((prev) => ({ ...prev, [sectionId]: { uploading: false, progress: 0, uploaded: false, error: "Upload failed" } }));
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm(locale === "nb" ? "Slette denne filen?" : "Delete this file?")) return;

    try {
      setDeletingFileId(fileId);
      setError("");

      const res = await fetch(`/api/archive/files/${fileId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to delete file");
        return;
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setError("Failed to delete file");
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
      if (res.ok && data?.ok) setDeletedFiles(data.files ?? []);
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
      setError("");

      const res = await fetch(`/api/archive/files/${fileId}/restore`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to restore file");
        return;
      }

      await Promise.all([loadDeletedFiles(), load()]);
    } catch {
      setError("Failed to restore file");
    } finally {
      setRestoringFileId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="customContainer border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {sections.map((section, index) => (
              <ContentSectionCard
                key={section.id}
                section={section}
                index={index}
                total={sections.length}
                locale={locale}
                files={files.filter((f) =>
                  f.sectionId === section.id &&
                  (section.type === "IMAGES" ? f.mimeType.startsWith("image/") : !f.mimeType.startsWith("image/")),
                )}
                uploadState={uploadStates[section.id]}
                deletingFileId={deletingFileId}
                onMove={handleMove}
                onDelete={handleDeleteSection}
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                textFieldsHandleRef={registerTextFieldsHandle}
                onTextFieldsDirtyChange={handleTextFieldsDirtyChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen seksjoner ennå" : "No sections yet"}</p>
      ) : null}

      <button type="button" className="customButtonEnabled self-start" onClick={() => setPickerOpen(true)}>
        {locale === "nb" ? "Legg til seksjon" : "Add section"}
      </button>

      {pickerOpen ? (
        <ContentSectionPicker
          locale={locale}
          onPick={(type) => void handleAddSection(type)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {dirty && (
        <button
          type="button"
          className="customButtonEnabled h-14 w-full text-base font-semibold"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
        </button>
      )}

      <button
        type="button"
        className="self-start text-sm text-textColorThird hover:underline"
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
        <div className="flex flex-col gap-1">
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
  );
}
