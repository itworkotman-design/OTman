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
  type PendingUploadRow,
} from "@/app/_components/Dahsboard/archive/ContentSectionCard";
import { ContentSectionPicker } from "@/app/_components/Dahsboard/archive/ContentSectionPicker";
import {
  ContentSaveUploadModal,
  type ContentSaveUploadItem,
} from "@/app/_components/Dahsboard/archive/ContentSaveUploadModal";
import type { TextFieldsPanelHandle } from "@/app/_components/Dahsboard/archive/TextFieldsPanel";
import type { SpreadsheetPanelHandle } from "@/app/_components/Dahsboard/archive/SpreadsheetPanel";
import type { TitlePanelHandle } from "@/app/_components/Dahsboard/archive/TitlePanel";
import type { YoutubeEmbedPanelHandle } from "@/app/_components/Dahsboard/archive/YoutubeEmbedPanel";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";

type ArchiveRecoverableFileRow = {
  id: string;
  originalFileName: string;
  sizeBytes: number;
  deletedAt: string;
  deletedByName: string | null;
};

// A file/image staged in one specific section, awaiting Save's upload phase.
// Extends ContentSectionCard's per-card PendingUploadRow (tempId/file/
// previewUrl) with the section it targets — ContentSectionList is the only
// place that needs to know which section a pending upload belongs to;
// ContentSectionCard just receives the pre-filtered list for its own section.
type StagedUpload = PendingUploadRow & { sectionKey: string };

// Deletion timestamp needs time-of-day precision (an audit column, not a
// last-modified date), unlike types.ts's formatLastModified's day-only
// "DD.MM.YY" convention — so this gets its own locale-aware formatter
// instead of reusing that one.
function formatDeletedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "nb" ? "nb-NO" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Uploads one staged file via XHR (for real progress events, unlike fetch),
// returning the created file's id. Used only from the Save button's upload
// phase now — nothing here fires until Save is clicked.
function uploadFileXhr(
  itemId: string,
  sectionId: string,
  file: File,
  description: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sectionId", sectionId);
  formData.append("description", description);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/archive/items/${itemId}/files`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      let data: { ok?: boolean; reason?: string; file?: { id: string } } | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (data?.ok && data.file?.id) resolve(data.file.id);
      else reject(new Error(data?.reason || "Upload failed"));
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

type Props = {
  itemId: string;
  locale: string;
  // Called once a save genuinely commits — skipped when the upload modal
  // was involved, since it already shows its own "Item saved" confirmation
  // and a second toast on top of it would just be redundant.
  onSaved?: () => void;
};

// The item settings page's "Content" area — a reorderable, addable list of
// Images/Files/Text-fields/Spreadsheet sections, mirroring
// website/BlogSectionList.tsx's drag+button reorder / add-section-picker
// pattern. Owns all staged state for the section: order, add/delete of whole
// sections, file/image uploads and deletes, and (via child panel handles)
// text-field/spreadsheet edits — none of it touches the server until the
// single Save button at the bottom is clicked. Uploads specifically are
// deferred all the way to actual bytes-over-the-wire: picking a file only
// stores the File object locally (see StagedUpload) until Save's upload
// phase runs it through ContentSaveUploadModal.
export function ContentSectionList({ itemId, locale, onSaved }: Props) {
  const [sections, setSections] = useState<ArchiveContentSectionRow[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [files, setFiles] = useState<ArchiveContentFileRow[]>([]);
  // Only gates the very first load — `load()` is also called mid-Save to
  // silently refresh after committing (see handleSave/runUploadPhase), and
  // that must NOT blank the whole tree: doing so used to fully unmount every
  // section (including the open upload modal), which then remounted and
  // re-fired each section's own fetch effect for no reason. Set once to
  // false on the first load and never touched again.
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Sections deleted locally but not yet confirmed with the server — removed
  // from `sections` immediately (optimistic hide), actually DELETEd only
  // during Save. Pending (never-created) sections being deleted just drop
  // out of `sections` with no entry here.
  const [pendingSectionDeletes, setPendingSectionDeletes] = useState<Set<string>>(new Set());

  const [pendingUploads, setPendingUploads] = useState<StagedUpload[]>([]);
  const [pendingFileDeletes, setPendingFileDeletes] = useState<Set<string>>(new Set());

  // Description edits on already-uploaded files, staged locally and only
  // PATCHed during Save — same deferred model as everything else here
  // (order, uploads, deletes), unlike an already-persisted text field's
  // "saves immediately" precedent (see TextFieldsPanel), which this
  // deliberately does NOT follow, per explicit user request. Keyed by
  // fileId; a file with no entry here just renders its persisted
  // `description` unchanged. An edit that lands back on the original value
  // removes its entry instead of leaving a no-op dirty flag (see
  // handleDescriptionChange).
  const [pendingDescriptions, setPendingDescriptions] = useState<Record<string, string>>({});

  // Per-section Text-fields/Spreadsheet handles/dirty flags, keyed by the
  // section's stable `key` (not its possibly-null `id`) — lets the
  // page-level Save button flush every section's staged edits, including
  // ones on a section that doesn't have a real id yet.
  const textFieldsHandles = useRef(new Map<string, TextFieldsPanelHandle>());
  const [textFieldsDirty, setTextFieldsDirty] = useState<Record<string, boolean>>({});

  const spreadsheetHandles = useRef(new Map<string, SpreadsheetPanelHandle>());
  const [spreadsheetDirty, setSpreadsheetDirty] = useState<Record<string, boolean>>({});

  const titleHandles = useRef(new Map<string, TitlePanelHandle>());
  const [titleDirty, setTitleDirty] = useState<Record<string, boolean>>({});

  const youtubeEmbedHandles = useRef(new Map<string, YoutubeEmbedPanelHandle>());
  const [youtubeEmbedDirty, setYoutubeEmbedDirty] = useState<Record<string, boolean>>({});

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalItems, setUploadModalItems] = useState<ContentSaveUploadItem[]>([]);
  const [uploadModalFinished, setUploadModalFinished] = useState(false);
  const cancelledRef = useRef(false);

  // True specifically while a cancelled save is hard-deleting whatever
  // finished uploading and un-creating the section(s) made just to host it
  // (see handleModalCloseRequest/handleSave). `saving` already covers this
  // same window, but a distinct flag + label ("Cleaning up...") makes it
  // obvious the Save button staying disabled isn't just leftover UI lag —
  // per explicit user request, so a second Save click can never overlap
  // with that cleanup still hard-deleting the previous attempt's files.
  const [cleaningUp, setCleaningUp] = useState(false);

  const [showDeletedFiles, setShowDeletedFiles] = useState(false);
  const [deletedFiles, setDeletedFiles] = useState<ArchiveRecoverableFileRow[]>([]);
  const [deletedFilesLoading, setDeletedFilesLoading] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    try {
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

      // Reuse the existing local `key` for a section we already know about
      // (matched by real id), instead of always re-keying from `s.id`. Save
      // calls `load()` right after creating a pending section server-side —
      // if that section's key jumped from its "pending-<uuid>" placeholder
      // to the real id here, ContentSectionCard/TextFieldsPanel would remount
      // (see ContentSectionCard's key-vs-id comment), discarding the panel's
      // local edit state and making it look locked until a full page reload.
      const loadedSections: ArchiveContentSectionRow[] = (sectionsData.sections ?? []).map(
        (s: { id: string; type: ArchiveContentSectionType; position: number }) => {
          const existing = sections.find((section) => section.id === s.id);
          return {
            key: existing?.key ?? s.id,
            id: s.id,
            type: s.type,
            position: s.position,
          };
        },
      );
      setSections(loadedSections);
      setSavedOrder(loadedSections.map((s) => s.key));
      textFieldsHandles.current.clear();
      spreadsheetHandles.current.clear();
      titleHandles.current.clear();
      youtubeEmbedHandles.current.clear();
      setTextFieldsDirty({});
      setSpreadsheetDirty({});
      setTitleDirty({});
      setYoutubeEmbedDirty({});
      setPendingSectionDeletes(new Set());
      setPendingFileDeletes(new Set());
      setPendingDescriptions({});
      if (filesRes.ok && filesData?.ok) setFiles(filesData.files ?? []);
    } catch {
      setError("Failed to load content sections");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Revoke every staged image's object URL on unmount, so navigating away
  // mid-edit doesn't leak blob URLs.
  useEffect(() => {
    return () => {
      for (const upload of pendingUploads) {
        if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on tab close/refresh while a save (including its post-cancel
  // cleanup) is in flight — leaving the page doesn't abort the in-progress
  // fetch/XHR calls, it just destroys this component's state, so the
  // background save/cleanup would finish invisibly with no way left to tell
  // the user what actually landed.
  useEffect(() => {
    if (!saving) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saving]);

  // Reordering, adding a section, and deleting a section all only touch this
  // one array vs. the `savedOrder` snapshot taken at load time — any of the
  // three throws it out of sync, which is exactly what should flag the Save
  // button, so no separate "structurally dirty" flag is needed on top of it.
  const orderDirty = sections.length !== savedOrder.length || sections.some((s, i) => s.key !== savedOrder[i]);
  const anyTextFieldsDirty = Object.values(textFieldsDirty).some(Boolean);
  const anySpreadsheetDirty = Object.values(spreadsheetDirty).some(Boolean);
  const anyTitleDirty = Object.values(titleDirty).some(Boolean);
  const anyYoutubeEmbedDirty = Object.values(youtubeEmbedDirty).some(Boolean);
  const descriptionsDirty = Object.keys(pendingDescriptions).length > 0;
  const dirty =
    orderDirty ||
    pendingUploads.length > 0 ||
    pendingFileDeletes.size > 0 ||
    descriptionsDirty ||
    anyTextFieldsDirty ||
    anySpreadsheetDirty ||
    anyTitleDirty ||
    anyYoutubeEmbedDirty;

  function registerTextFieldsHandle(sectionKey: string, handle: TextFieldsPanelHandle | null) {
    if (handle) textFieldsHandles.current.set(sectionKey, handle);
    else textFieldsHandles.current.delete(sectionKey);
  }

  function handleTextFieldsDirtyChange(sectionKey: string, sectionDirty: boolean) {
    setTextFieldsDirty((prev) => (prev[sectionKey] === sectionDirty ? prev : { ...prev, [sectionKey]: sectionDirty }));
  }

  function registerSpreadsheetHandle(sectionKey: string, handle: SpreadsheetPanelHandle | null) {
    if (handle) spreadsheetHandles.current.set(sectionKey, handle);
    else spreadsheetHandles.current.delete(sectionKey);
  }

  function handleSpreadsheetDirtyChange(sectionKey: string, sectionDirty: boolean) {
    setSpreadsheetDirty((prev) => (prev[sectionKey] === sectionDirty ? prev : { ...prev, [sectionKey]: sectionDirty }));
  }

  function registerTitleHandle(sectionKey: string, handle: TitlePanelHandle | null) {
    if (handle) titleHandles.current.set(sectionKey, handle);
    else titleHandles.current.delete(sectionKey);
  }

  function handleTitleDirtyChange(sectionKey: string, sectionDirty: boolean) {
    setTitleDirty((prev) => (prev[sectionKey] === sectionDirty ? prev : { ...prev, [sectionKey]: sectionDirty }));
  }

  function registerYoutubeEmbedHandle(sectionKey: string, handle: YoutubeEmbedPanelHandle | null) {
    if (handle) youtubeEmbedHandles.current.set(sectionKey, handle);
    else youtubeEmbedHandles.current.delete(sectionKey);
  }

  function handleYoutubeEmbedDirtyChange(sectionKey: string, sectionDirty: boolean) {
    setYoutubeEmbedDirty((prev) => (prev[sectionKey] === sectionDirty ? prev : { ...prev, [sectionKey]: sectionDirty }));
  }

  function handleMove(key: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.key === key);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    setSections(arrayMove(sections, index, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.key === active.id);
    const newIndex = sections.findIndex((s) => s.key === over.id);
    setSections(arrayMove(sections, oldIndex, newIndex));
  }

  // No network call — a new section only really gets created when Save's
  // first phase runs (see handleSave). `id: null` marks it pending.
  function handleAddSection(type: ArchiveContentSectionType) {
    const key = `pending-${crypto.randomUUID()}`;
    setSections((prev) => [...prev, { key, id: null, type, position: prev.length }]);
  }

  // A pending (never-created) section just disappears with no bookkeeping.
  // A real section is hidden immediately and queued for deletion at Save
  // time; any uploads staged for it are dropped too, since there'll be
  // nothing left to attach them to.
  function handleDeleteSection(key: string) {
    const section = sections.find((s) => s.key === key);
    if (!section) return;

    setSections((prev) => prev.filter((s) => s.key !== key));
    textFieldsHandles.current.delete(key);
    spreadsheetHandles.current.delete(key);
    titleHandles.current.delete(key);
    youtubeEmbedHandles.current.delete(key);
    setTextFieldsDirty((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setSpreadsheetDirty((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setTitleDirty((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setYoutubeEmbedDirty((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setPendingUploads((prev) => {
      for (const upload of prev) {
        if (upload.sectionKey === key && upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      }
      return prev.filter((u) => u.sectionKey !== key);
    });

    if (section.id) {
      setPendingSectionDeletes((prev) => new Set(prev).add(section.id!));
    }
  }

  // Staging only — the File object sits in memory until Save's upload phase.
  function handleStageUpload(sectionKey: string, file: File) {
    const tempId = crypto.randomUUID();
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setPendingUploads((prev) => [...prev, { tempId, sectionKey, file, previewUrl, description: "" }]);
  }

  function handleStagedDescriptionChange(tempId: string, description: string) {
    setPendingUploads((prev) => prev.map((u) => (u.tempId === tempId ? { ...u, description } : u)));
  }

  function handleDiscardPendingUpload(tempId: string) {
    setPendingUploads((prev) => {
      const target = prev.find((u) => u.tempId === tempId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((u) => u.tempId !== tempId);
    });
  }

  // Hides the file immediately (optimistic); the actual soft-delete only
  // happens at Save time. Reversible for free by just not clicking Save.
  function handleDeleteFile(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setPendingFileDeletes((prev) => new Set(prev).add(fileId));
    setPendingDescriptions((prev) => {
      if (!(fileId in prev)) return prev;
      const { [fileId]: _removed, ...rest } = prev;
      return rest;
    });
  }

  // Staging only, same as every other edit here — the PATCH only fires
  // during Save (see handleSave's description-flush step). Removes its own
  // entry if the edit lands back on the originally-loaded value, so typing
  // something and then undoing it doesn't leave the Save button spuriously
  // enabled.
  function handleDescriptionChange(fileId: string, description: string) {
    const original = files.find((f) => f.id === fileId)?.description ?? "";
    setPendingDescriptions((prev) => {
      if (description === original) {
        if (!(fileId in prev)) return prev;
        const { [fileId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fileId]: description };
    });
  }

  function updateUploadItem(id: string, patch: Partial<ContentSaveUploadItem>) {
    setUploadModalItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function createSectionOnServer(section: ArchiveContentSectionRow): Promise<string | null> {
    const res = await fetch(`/api/archive/items/${itemId}/content-sections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: section.type }),
    });
    const data = await res.json().catch(() => null);
    return res.ok && data?.ok ? (data.section.id as string) : null;
  }

  // Uploads run one at a time (simplest correct progress reporting,
  // comfortably under the server's ARCHIVE_MAX_CONCURRENT_UPLOADS gate).
  // Returns whether the modal was cancelled early — the caller (handleSave)
  // decides what that means for the rest of the save, since this function
  // only owns the upload loop + modal state, not the metadata commit. A
  // cancelled save lets whatever's already in flight finish rather than
  // aborting mid-request, then hard-deletes every file that did finish
  // uploading via the discard route — see handleModalCloseRequest.
  async function runUploadPhase(
    uploads: { upload: StagedUpload; realSectionId: string }[],
  ): Promise<{ cancelled: boolean }> {
    const items: ContentSaveUploadItem[] = uploads.map(({ upload }) => {
      const section = sections.find((s) => s.key === upload.sectionKey);
      return {
        id: upload.tempId,
        fileName: upload.file.name,
        sectionLabel: section ? getContentSectionLabel(section.type, locale).name : "",
        status: "queued",
        progress: 0,
      };
    });

    cancelledRef.current = false;
    setUploadModalItems(items);
    setUploadModalFinished(false);
    setUploadModalOpen(true);

    const uploadedFileIds: string[] = [];

    for (const { upload, realSectionId } of uploads) {
      if (cancelledRef.current) break;

      updateUploadItem(upload.tempId, { status: "uploading" });
      try {
        const fileId = await uploadFileXhr(itemId, realSectionId, upload.file, upload.description, (progress) =>
          updateUploadItem(upload.tempId, { progress }),
        );
        uploadedFileIds.push(fileId);
        updateUploadItem(upload.tempId, { status: "done", progress: 100 });
      } catch (err) {
        updateUploadItem(upload.tempId, { status: "failed", error: err instanceof Error ? err.message : "Upload failed" });
      }
    }

    if (cancelledRef.current) {
      await Promise.all(
        uploadedFileIds.map((fileId) =>
          fetch(`/api/archive/items/${itemId}/files/${fileId}/discard`, { method: "DELETE", credentials: "include" }),
        ),
      );
      // Staged uploads that never made it through (or got rolled back) are
      // deliberately left in `pendingUploads` untouched — the user closed
      // the popup early, not the item settings page, so the picked files
      // stay staged and Save can just be pressed again.
      setUploadModalOpen(false);
      return { cancelled: true };
    }

    for (const upload of pendingUploads) {
      if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    }
    setPendingUploads([]);
    setUploadModalFinished(true);
    return { cancelled: false };
  }

  async function handleSave() {
    // Re-entrancy guard: a save (or a cancelled save's cleanup, which keeps
    // `saving` true the whole time) is already running — a second click
    // must never start a new upload/section-create while the previous
    // attempt's rollback could still be hard-deleting files out from under
    // it. The button is already `disabled={saving}`, this is just defense
    // in depth.
    if (saving) return;

    try {
      setSaving(true);
      setError("");

      // Drop any pending (never-created) Images/Files section that has
      // nothing staged in it — e.g. a leftover from a cancelled upload whose
      // individual staged files were all discarded one by one, or one added
      // via the picker and never filled in. An empty section is never
      // useful once saved, and silently creating it is exactly how "orphan
      // empty section" confusion happens. TEXT_FIELDS/SPREADSHEET/TITLE
      // pending sections are exempt — an intentionally-empty one of those is
      // still a meaningful container (a fresh grid, a place to add fields
      // later, a title to fill in after).
      const pendingUploadSectionKeys = new Set(pendingUploads.map((u) => u.sectionKey));
      const emptyPendingKeys = sections
        .filter((s) => s.id === null && (s.type === "IMAGES" || s.type === "FILES") && !pendingUploadSectionKeys.has(s.key))
        .map((s) => s.key);

      const workingSections =
        emptyPendingKeys.length > 0 ? sections.filter((s) => !emptyPendingKeys.includes(s.key)) : sections;

      if (emptyPendingKeys.length > 0) {
        setSections((prev) => prev.filter((s) => !emptyPendingKeys.includes(s.key)));
      }

      const keyToRealId = new Map<string, string>();
      for (const s of workingSections) if (s.id) keyToRealId.set(s.key, s.id);

      // Only sections a pending upload actually targets get created up
      // front — uploads need a real section id to attach to, so this part
      // can't be deferred like everything else below. Everything else
      // (remaining pending sections with no upload, text-field/spreadsheet
      // flushes, deletes, reorder) is deliberately held back until AFTER
      // the upload phase resolves, so that closing the upload modal early
      // can cleanly undo the WHOLE save — not just the files — instead of
      // leaving unrelated metadata changes committed. Per explicit user
      // request: cancelling should mean "as if Save was never pressed".
      const uploadSectionKeys = new Set(
        pendingUploads.map((u) => u.sectionKey).filter((key) => !keyToRealId.has(key)),
      );
      const createdForUploadKeys: string[] = [];

      for (const key of uploadSectionKeys) {
        const section = workingSections.find((s) => s.key === key);
        if (!section) continue;
        const realId = await createSectionOnServer(section);
        if (!realId) {
          setError("Failed to create section");
          setSaving(false);
          return;
        }
        keyToRealId.set(key, realId);
        createdForUploadKeys.push(key);
      }

      if (createdForUploadKeys.length > 0) {
        setSections((prev) => prev.map((s) => (createdForUploadKeys.includes(s.key) ? { ...s, id: keyToRealId.get(s.key)! } : s)));
      }

      const uploads = pendingUploads
        .map((upload) => ({ upload, realSectionId: keyToRealId.get(upload.sectionKey) }))
        .filter((entry): entry is { upload: StagedUpload; realSectionId: string } => Boolean(entry.realSectionId));

      if (uploads.length > 0) {
        const { cancelled } = await runUploadPhase(uploads);

        if (cancelled) {
          // Nothing else was ever committed — undo just the sections that
          // were only created moments ago to host these uploads, and flip
          // them back to "pending" locally so Save can be retried later
          // (deliberately NOT a `load()` here — that would replace `sections`
          // with the server's list, which has no entry at all for something
          // that's purely a local draft, silently orphaning `pendingUploads`
          // with no rendered row left to retry from).
          //
          // If a DELETE actually fails (e.g. a transient 500), the section
          // survives server-side as a real, empty section — reverting it to
          // "pending" anyway would make the NEXT Save create a fresh
          // duplicate alongside that orphan. So a failed delete deliberately
          // leaves the section's real id in place instead: the next Save
          // then re-targets that same still-real (now empty) section rather
          // than creating a new one.
          const failedToDeleteKeys: string[] = [];
          for (const key of createdForUploadKeys) {
            const realId = keyToRealId.get(key);
            if (!realId) continue;
            const res = await fetch(`/api/archive/content-sections/${realId}`, { method: "DELETE", credentials: "include" });
            if (!res.ok) failedToDeleteKeys.push(key);
          }

          const revertedKeys = createdForUploadKeys.filter((key) => !failedToDeleteKeys.includes(key));
          setSections((prev) => prev.map((s) => (revertedKeys.includes(s.key) ? { ...s, id: null } : s)));

          if (failedToDeleteKeys.length > 0) {
            setError(
              locale === "nb"
                ? "Kunne ikke fjerne en seksjon etter avbrutt opplasting, men ingenting gikk tapt — prøv å lagre igjen."
                : "Failed to remove a section after the cancelled upload, but nothing was lost — try saving again.",
            );
          }

          setCleaningUp(false);
          setSaving(false);
          return;
        }
      }

      // Everything from here on only runs once uploads (if any) are
      // confirmed done — this is the actual metadata commit.

      // 1. Create any remaining pending sections (not upload-related).
      // Checked against `keyToRealId`, NOT `s.id` — `s` comes from
      // `workingSections`, a snapshot taken at the top of this function, so
      // `s.id` is stale and still null for anything the upload-target loop
      // above already created. `keyToRealId` is the one map kept truly up
      // to date across both loops; checking `s.id` here previously created
      // a genuine DUPLICATE section for every upload-target section (its
      // real id then got silently overwritten in `keyToRealId` by the
      // duplicate's id, which is exactly what made the reorder call
      // mismatch the server's actual section set).
      for (const s of workingSections) {
        if (keyToRealId.has(s.key)) continue;
        const realId = await createSectionOnServer(s);
        if (!realId) {
          setError("Failed to create section");
          setSaving(false);
          return;
        }
        keyToRealId.set(s.key, realId);
      }

      const resolvedSections = workingSections.map((s) => ({ ...s, id: keyToRealId.get(s.key) ?? s.id }));
      setSections(resolvedSections);
      // Section create/delete/reorder all commit in this same phase, so the
      // dirty snapshot can settle now instead of staying stuck true
      // (mismatched length/order against the pre-save `savedOrder`).
      setSavedOrder(resolvedSections.map((s) => s.key));

      // 2. Flush staged text-field/spreadsheet edits against the now-real ids.
      for (const [key, handle] of textFieldsHandles.current) {
        const realId = keyToRealId.get(key);
        if (realId) await handle.flushPendingChanges(realId);
      }
      for (const [key, handle] of spreadsheetHandles.current) {
        const realId = keyToRealId.get(key);
        if (realId) await handle.flushPendingChanges(realId);
      }
      for (const [key, handle] of titleHandles.current) {
        const realId = keyToRealId.get(key);
        if (realId) await handle.flushPendingChanges(realId);
      }
      for (const [key, handle] of youtubeEmbedHandles.current) {
        const realId = keyToRealId.get(key);
        if (realId) await handle.flushPendingChanges(realId);
      }

      // 2b. Flush staged file-description edits. Skips anything also queued
      // for deletion just below — no point saving a description on a file
      // that's about to stop existing.
      const descriptionEntries = Object.entries(pendingDescriptions).filter(
        ([fileId]) => !pendingFileDeletes.has(fileId),
      );
      if (descriptionEntries.length > 0) {
        const results = await Promise.all(
          descriptionEntries.map(([fileId, description]) =>
            fetch(`/api/archive/files/${fileId}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description }),
            }),
          ),
        );
        if (results.some((res) => !res.ok)) {
          setError("Failed to save file descriptions");
          setSaving(false);
          return;
        }
      }
      setPendingDescriptions({});

      // 3. Apply staged section/file deletes BEFORE reordering — the reorder
      // endpoint requires its id list to exactly match the server's current
      // (non-deleted) section set, which still includes anything pending
      // deletion until these calls land.
      //
      // Section deletes specifically must run ONE AT A TIME, not via
      // Promise.all: deleteContentSection re-indexes every remaining
      // sibling section's position inside its own transaction, so two of
      // these firing concurrently for the same item race to update
      // overlapping rows in different orders — Postgres detects that as a
      // deadlock (40P01) and kills one of the transactions. Sequencing them
      // means each reposition fully commits before the next delete reads
      // the (now-updated) sibling list.
      for (const id of pendingSectionDeletes) {
        await fetch(`/api/archive/content-sections/${id}`, { method: "DELETE", credentials: "include" });
      }
      await Promise.all(
        [...pendingFileDeletes].map((id) => fetch(`/api/archive/files/${id}`, { method: "DELETE", credentials: "include" })),
      );
      setPendingSectionDeletes(new Set());
      setPendingFileDeletes(new Set());

      // 4. Persist the final order, if it changed. `resolvedSections` already
      // excludes anything just deleted above, so this now matches exactly
      // what the server has left.
      const orderedRealIds = resolvedSections.map((s) => keyToRealId.get(s.key)).filter((id): id is string => Boolean(id));
      if (orderDirty && orderedRealIds.length > 0) {
        const res = await fetch(`/api/archive/items/${itemId}/content-sections/reorder`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderedRealIds.map((id, position) => ({ id, position }))),
        });
        if (!res.ok) {
          setError("Failed to save section order");
          // Every section involved here is already real (this only runs
          // after uploads/creates/deletes have all committed), so re-syncing
          // from the server is safe and surfaces any mismatch immediately
          // instead of leaving stale local state around for the next Save
          // to trip over again.
          await load();
          setSaving(false);
          return;
        }
      }

      await load();
      setSaving(false);
      if (uploads.length === 0) onSaved?.();
    } catch {
      setError("Failed to save changes");
      setCleaningUp(false);
      setSaving(false);
    }
  }

  function handleModalCloseRequest() {
    if (uploadModalFinished) {
      setUploadModalOpen(false);
      return;
    }

    const warning =
      locale === "nb"
        ? "Filer som fortsatt lastes opp vil ikke bli lagret og vil bli slettet. Lukke likevel?"
        : "Files still uploading will not be saved and will be deleted. Close anyway?";
    if (!confirm(warning)) return;

    cancelledRef.current = true;
    setUploadModalOpen(false);
    setCleaningUp(true);
    // runUploadPhase's loop notices cancelledRef on its next iteration,
    // lets whatever's already in flight finish, then discards it — see
    // there for the rollback itself. `cleaningUp` stays true (keeping Save
    // disabled) until handleSave's cancelled branch finishes un-creating
    // the section(s) made for this upload, right after that discard.
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

  if (initialLoading) {
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
        <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {sections.map((section, index) => (
              <ContentSectionCard
                key={section.key}
                section={section}
                index={index}
                total={sections.length}
                locale={locale}
                files={files
                  .filter((f) => f.sectionId === section.id)
                  .map((f) => (f.id in pendingDescriptions ? { ...f, description: pendingDescriptions[f.id] } : f))}
                pendingUploads={pendingUploads.filter((u) => u.sectionKey === section.key)}
                onMove={handleMove}
                onDelete={handleDeleteSection}
                onStageUpload={handleStageUpload}
                onDiscardPendingUpload={handleDiscardPendingUpload}
                onDeleteFile={handleDeleteFile}
                onDescriptionChange={handleDescriptionChange}
                onStageDescriptionChange={handleStagedDescriptionChange}
                textFieldsHandleRef={registerTextFieldsHandle}
                onTextFieldsDirtyChange={handleTextFieldsDirtyChange}
                spreadsheetHandleRef={registerSpreadsheetHandle}
                onSpreadsheetDirtyChange={handleSpreadsheetDirtyChange}
                titleHandleRef={registerTitleHandle}
                onTitleDirtyChange={handleTitleDirtyChange}
                youtubeEmbedHandleRef={registerYoutubeEmbedHandle}
                onYoutubeEmbedDirtyChange={handleYoutubeEmbedDirtyChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen seksjoner ennå" : "No sections yet"}</p>
      ) : null}

      <button
        type="button"
        className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-lineSecondary py-6 text-textColorThird transition-colors hover:border-logoblue hover:bg-linePrimary/40 hover:text-logoblue"
        onClick={() => setPickerOpen(true)}
      >
        <span className="text-3xl font-light leading-none">+</span>
        <span className="text-sm font-medium">{locale === "nb" ? "Legg til seksjon" : "Add section"}</span>
      </button>

      {pickerOpen ? (
        <ContentSectionPicker locale={locale} onPick={handleAddSection} onClose={() => setPickerOpen(false)} />
      ) : null}

      {dirty && (
        <>
          {/* Reserves space so the fixed bar below doesn't cover the last content. */}
          <div className="h-20" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-30 px-6 pb-6 pt-3 lg:pl-(--sidebar-width) lg:pr-6">
            <div className="mx-auto w-full max-w-4xl lg:max-w-[1600]">
              <button
                type="button"
                className="customButtonEnabled h-14 w-full text-base font-semibold shadow-lg"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {cleaningUp
                  ? locale === "nb"
                    ? "Rydder opp..."
                    : "Cleaning up..."
                  : saving
                    ? locale === "nb"
                      ? "Lagrer..."
                      : "Saving..."
                    : locale === "nb"
                      ? "Lagre"
                      : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      {uploadModalOpen && (
        <ContentSaveUploadModal
          locale={locale}
          items={uploadModalItems}
          finished={uploadModalFinished}
          onClose={handleModalCloseRequest}
        />
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
        <div>
          {deletedFilesLoading ? (
            <div className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</div>
          ) : deletedFiles.length === 0 ? (
            <div className="text-sm text-textColorThird">
              {locale === "nb" ? "Ingen slettede filer" : "No deleted files"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-lineSecondary">
              {/* Server (listRecoverableFilesForItemWithActor) already sorts
                  most-recently-deleted first — no client-side re-sort here. */}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-lineSecondary text-xs text-textColorThird">
                    <th className="px-3 py-2 font-medium">{locale === "nb" ? "Fil" : "File"}</th>
                    <th className="px-3 py-2 font-medium">{locale === "nb" ? "Slettet" : "Deleted"}</th>
                    <th className="px-3 py-2 font-medium">{locale === "nb" ? "Slettet av" : "Deleted by"}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {deletedFiles.map((file) => (
                    <tr key={file.id} className="border-b border-lineSecondary last:border-0">
                      <td className="px-3 py-2 text-textColorSecond">{file.originalFileName}</td>
                      <td className="px-3 py-2 text-textColorThird">{formatDeletedAt(file.deletedAt, locale)}</td>
                      <td className="px-3 py-2 text-textColorThird">
                        {file.deletedByName ?? (locale === "nb" ? "Ukjent" : "Unknown")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-logoblue hover:underline"
                          onClick={() => void handleRestoreFile(file.id)}
                          disabled={restoringFileId === file.id}
                        >
                          {locale === "nb" ? "Gjenopprett" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
