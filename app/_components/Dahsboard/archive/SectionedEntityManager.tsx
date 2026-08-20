"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExpandablePanelList } from "./ExpandablePanelList";
import { UNGROUPED_SECTION_ID } from "./types";
import type { ArchiveFolderSummary, ArchiveItemSummary, ArchiveSectionSummary } from "./types";

type CreateResult = { ok: boolean; reason?: string };

type SectionedEntityManagerProps = {
  // null = the archive root's own section scope (top-level folders).
  parentFolderId: string | null;
  locale: string;
  folders: ArchiveFolderSummary[];
  // Omitted at the root, which has no items of its own.
  items?: ArchiveItemSummary[];
  renderFolderRow: (folder: ArchiveFolderSummary) => ReactNode;
  renderItemRow?: (item: ArchiveItemSummary) => ReactNode;
  // Column-label row (see PillFieldsHeader in EntityPill.tsx) shown above a
  // section's own folders/items list, once per section — the caller builds
  // it since only it knows what PillFields the rows below actually carry.
  // Omitted entirely (no reserved space) by callers with nothing to caption.
  folderListHeader?: ReactNode;
  itemListHeader?: ReactNode;
  onCreateSubfolder: (sectionId: string | null, name: string, description: string | null) => Promise<CreateResult>;
  onCreateItem?: (sectionId: string | null, name: string, description: string | null) => Promise<CreateResult>;
  // Called after a folder/item is moved into a different section, so the
  // caller can refetch its own folders/items list (which carries sectionId).
  onFoldersChanged: () => void;
  onItemsChanged?: () => void;
};

// Single "+ Add" entry point at the top of a section, replacing the old
// separate "+ New subfolder" / "+ New item" buttons. A dropdown so more
// creatable kinds can be added later without adding more buttons.
function SectionAddMenu({
  open,
  onOpen,
  onClose,
  onSelectFolder,
  onSelectItem,
  showItem,
  addLabel,
  folderLabel,
  itemLabel,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectFolder: () => void;
  onSelectItem: () => void;
  showItem: boolean;
  addLabel: string;
  folderLabel: string;
  itemLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose]);

  return (
    <div ref={containerRef} className="relative w-fit">
      <button
        type="button"
        className="customButtonEnabled h-9 px-4 text-sm transition hover:brightness-95"
        onClick={() => (open ? onClose() : onOpen())}
      >
        {addLabel}
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-48 overflow-hidden rounded-2xl border border-lineSecondary bg-white text-left shadow-lg">
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-linePrimary"
            onClick={onSelectFolder}
          >
            {folderLabel}
          </button>
          {showItem && (
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-linePrimary"
              onClick={onSelectItem}
            >
              {itemLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Groups a folder's subfolders/items into named sections instead of one flat
// "add subfolder" / "add item" pair of forms. Sections are optional — a
// subfolder/item can be created with no section at all via the "Ungrouped"
// bucket's own add menu, which also holds pre-existing content created
// before this feature shipped or before it was ever moved into a section,
// with a "Move to..." picker to file it into one later. Shared between the
// archive root (folders only) and a folder's own settings page (folders +
// items) via the optional item props.
export function SectionedEntityManager({
  parentFolderId,
  locale,
  folders,
  items,
  renderFolderRow,
  renderItemRow,
  folderListHeader,
  itemListHeader,
  onCreateSubfolder,
  onCreateItem,
  onFoldersChanged,
  onItemsChanged,
}: SectionedEntityManagerProps) {
  const sectionsBase = parentFolderId ? `/api/archive/folders/${parentFolderId}/sections` : "/api/archive/sections";

  const [sections, setSections] = useState<ArchiveSectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [createSectionError, setCreateSectionError] = useState("");
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [sectionActionError, setSectionActionError] = useState("");

  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDescription, setRenameDescription] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [openAddMenuFor, setOpenAddMenuFor] = useState<string | null>(null);

  const [openFolderFormFor, setOpenFolderFormFor] = useState<string | null>(null);
  const [folderFormName, setFolderFormName] = useState("");
  const [folderFormDescription, setFolderFormDescription] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderFormError, setFolderFormError] = useState("");

  const [openItemFormFor, setOpenItemFormFor] = useState<string | null>(null);
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormDescription, setItemFormDescription] = useState("");
  const [creatingItem, setCreatingItem] = useState(false);
  const [itemFormError, setItemFormError] = useState("");

  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  async function loadSections() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(sectionsBase, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load sections");
        return;
      }

      setSections(data.sections ?? []);
    } catch {
      setError("Failed to load sections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsBase]);

  async function handleCreateSection() {
    const name = newSectionName.trim();
    if (!name) return;

    try {
      setCreatingSection(true);
      setCreateSectionError("");

      const res = await fetch(sectionsBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newSectionDescription.trim() || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateSectionError(data?.reason || "Failed to create section");
        return;
      }

      setNewSectionName("");
      setNewSectionDescription("");
      await loadSections();
    } catch {
      setCreateSectionError("Failed to create section");
    } finally {
      setCreatingSection(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm(locale === "nb" ? "Slette denne seksjonen?" : "Delete this section?")) return;

    try {
      setDeletingSectionId(sectionId);
      setSectionActionError("");

      const res = await fetch(`/api/archive/sections/${sectionId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setSectionActionError(
          data?.reason === "NOT_EMPTY"
            ? locale === "nb"
              ? "Seksjonen må være tom før den kan slettes"
              : "The section must be empty before it can be deleted"
            : data?.reason || "Failed to delete section",
        );
        return;
      }

      await loadSections();
    } catch {
      setSectionActionError("Failed to delete section");
    } finally {
      setDeletingSectionId(null);
    }
  }

  function startRenameSection(section: ArchiveSectionSummary) {
    setRenamingSectionId(section.id);
    setRenameName(section.name);
    setRenameDescription(section.description ?? "");
    setSectionActionError("");
  }

  function cancelRenameSection() {
    setRenamingSectionId(null);
    setSectionActionError("");
  }

  async function handleRenameSection(sectionId: string) {
    const name = renameName.trim();
    if (!name) return;

    try {
      setSavingRename(true);
      setSectionActionError("");

      const res = await fetch(`/api/archive/sections/${sectionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: renameDescription.trim() || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setSectionActionError(data?.reason || "Failed to rename section");
        return;
      }

      setRenamingSectionId(null);
      await loadSections();
    } catch {
      setSectionActionError("Failed to rename section");
    } finally {
      setSavingRename(false);
    }
  }

  function openCreateForm(sectionId: string, kind: "folder" | "item") {
    setOpenAddMenuFor(null);
    if (kind === "folder") {
      setOpenItemFormFor(null);
      setOpenFolderFormFor(sectionId);
      setFolderFormName("");
      setFolderFormDescription("");
      setFolderFormError("");
    } else {
      setOpenFolderFormFor(null);
      setOpenItemFormFor(sectionId);
      setItemFormName("");
      setItemFormDescription("");
      setItemFormError("");
    }
  }

  function toggleFolderForm(sectionId: string) {
    const opening = openFolderFormFor !== sectionId;
    setOpenFolderFormFor(opening ? sectionId : null);
    setFolderFormName("");
    setFolderFormDescription("");
    setFolderFormError("");
  }

  async function handleCreateFolderIn(sectionId: string) {
    const name = folderFormName.trim();
    if (!name) return;

    try {
      setCreatingFolder(true);
      setFolderFormError("");

      const result = await onCreateSubfolder(
        sectionId === UNGROUPED_SECTION_ID ? null : sectionId,
        name,
        folderFormDescription.trim() || null,
      );

      if (!result.ok) {
        setFolderFormError(result.reason || "Failed to create subfolder");
        return;
      }

      setOpenFolderFormFor(null);
      setFolderFormName("");
      setFolderFormDescription("");
      await loadSections();
    } finally {
      setCreatingFolder(false);
    }
  }

  function toggleItemForm(sectionId: string) {
    const opening = openItemFormFor !== sectionId;
    setOpenItemFormFor(opening ? sectionId : null);
    setItemFormName("");
    setItemFormDescription("");
    setItemFormError("");
  }

  async function handleCreateItemIn(sectionId: string) {
    if (!onCreateItem) return;
    const name = itemFormName.trim();
    if (!name) return;

    try {
      setCreatingItem(true);
      setItemFormError("");

      const result = await onCreateItem(
        sectionId === UNGROUPED_SECTION_ID ? null : sectionId,
        name,
        itemFormDescription.trim() || null,
      );

      if (!result.ok) {
        setItemFormError(result.reason || "Failed to create item");
        return;
      }

      setOpenItemFormFor(null);
      setItemFormName("");
      setItemFormDescription("");
      await loadSections();
    } finally {
      setCreatingItem(false);
    }
  }

  async function handleMoveFolder(folderId: string, sectionId: string) {
    try {
      setMovingFolderId(folderId);

      const res = await fetch(`/api/archive/folders/${folderId}/section`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        await Promise.all([loadSections(), onFoldersChanged()]);
      }
    } finally {
      setMovingFolderId(null);
    }
  }

  async function handleMoveItem(itemId: string, sectionId: string) {
    try {
      setMovingItemId(itemId);

      const res = await fetch(`/api/archive/items/${itemId}/section`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        await Promise.all([loadSections(), onItemsChanged?.()]);
      }
    } finally {
      setMovingItemId(null);
    }
  }

  const t = {
    sections: locale === "nb" ? "Seksjoner" : "Sections",
    newSection: locale === "nb" ? "Ny seksjon" : "New section",
    name: locale === "nb" ? "Navn" : "Name",
    description: locale === "nb" ? "Beskrivelse" : "Description",
    create: locale === "nb" ? "Opprett" : "Create",
    creating: locale === "nb" ? "Oppretter..." : "Creating...",
    delete: locale === "nb" ? "Slett" : "Delete",
    rename: locale === "nb" ? "Endre navn" : "Rename",
    save: locale === "nb" ? "Lagre" : "Save",
    addNew: locale === "nb" ? "+ Legg til" : "+ Add",
    subfolder: locale === "nb" ? "Undermappe" : "Subfolder",
    item: locale === "nb" ? "Element" : "Item",
    foldersHeading: locale === "nb" ? "Mapper" : "Folders",
    itemsHeading: locale === "nb" ? "Elementer" : "Items",
    cancel: locale === "nb" ? "Avbryt" : "Cancel",
    ungrouped: locale === "nb" ? "Ugruppert" : "Ungrouped",
    ungroupedHint:
      locale === "nb"
        ? "Ikke i en seksjon ennå. Flytt til en seksjon:"
        : "Not in a section yet. Move to a section:",
    ungroupedEmpty: locale === "nb" ? "Ingenting her ennå" : "Nothing here yet",
    loadingSections: locale === "nb" ? "Laster seksjoner..." : "Loading sections...",
    moveTo: locale === "nb" ? "Velg seksjon..." : "Choose a section...",
    folderCount: (n: number) => `${n} ${locale === "nb" ? "mapper" : n === 1 ? "folder" : "folders"}`,
    itemCount: (n: number) => `${n} ${locale === "nb" ? "elementer" : n === 1 ? "item" : "items"}`,
  };

  const foldersBySection = new Map<string, ArchiveFolderSummary[]>();
  for (const folder of folders) {
    const key = folder.sectionId ?? UNGROUPED_SECTION_ID;
    const list = foldersBySection.get(key) ?? [];
    list.push(folder);
    foldersBySection.set(key, list);
  }

  const itemsBySection = new Map<string, ArchiveItemSummary[]>();
  for (const item of items ?? []) {
    const key = item.sectionId ?? UNGROUPED_SECTION_ID;
    const list = itemsBySection.get(key) ?? [];
    list.push(item);
    itemsBySection.set(key, list);
  }

  const ungroupedFolders = foldersBySection.get(UNGROUPED_SECTION_ID) ?? [];
  const ungroupedItems = itemsBySection.get(UNGROUPED_SECTION_ID) ?? [];
  const ungroupedHasContent = ungroupedFolders.length > 0 || ungroupedItems.length > 0;

  const panelItems = sections.map((section) => {
    const sectionFolders = foldersBySection.get(section.id) ?? [];
    const sectionItems = itemsBySection.get(section.id) ?? [];
    // Derived from the live folders/items props (already recomputed above)
    // rather than section.folderCount/itemCount, which only refreshes on the
    // next loadSections() call. Folder/item deletion happens outside this
    // component (via EntityPill's onChanged -> onFoldersChanged/
    // onItemsChanged), so relying on the fetched section counts left Delete
    // disabled until the settings view was reopened even after a section's
    // last folder/item was removed.
    const isEmpty = sectionFolders.length === 0 && sectionItems.length === 0;
    const isRenaming = renamingSectionId === section.id;

    const subtitleParts: string[] = [];
    if (sectionFolders.length > 0) subtitleParts.push(t.folderCount(sectionFolders.length));
    if (sectionItems.length > 0) subtitleParts.push(t.itemCount(sectionItems.length));

    return {
      id: section.id,
      title: isRenaming ? (
        <span onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5 py-0.5">
          <input
            className="customInput w-full max-w-70 rounded-lg bg-white py-1 text-[15px] font-bold text-textcolor"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              // Stop here so a space (or any other key) doesn't bubble up to
              // ExpandablePanelList's header row, which toggles
              // expand/collapse on Space and would otherwise eat the
              // keystroke via its own preventDefault before it reaches this
              // input's value.
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRenameSection(section.id);
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRenameSection();
              }
            }}
            disabled={savingRename}
            type="text"
            placeholder={t.name}
            autoFocus
          />
          <input
            className="customInput w-full max-w-70 rounded-lg bg-white py-1 text-sm font-normal text-textcolor"
            value={renameDescription}
            onChange={(e) => setRenameDescription(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRenameSection(section.id);
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRenameSection();
              }
            }}
            disabled={savingRename}
            type="text"
            placeholder={t.description}
          />
        </span>
      ) : (
        section.name
      ),
      description: isRenaming ? undefined : (section.description ?? undefined),
      subtitle: subtitleParts.join(" · "),
      // Rename/Delete render in the header (not the collapsible content) so
      // they're reachable whether or not the section is expanded, and every
      // section always appears here regardless of content — only whether
      // Delete is clickable depends on isEmpty.
      headerActions: isRenaming ? (
        <>
          <button
            type="button"
            className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-logoblue hover:opacity-90 disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              void handleRenameSection(section.id);
            }}
            disabled={savingRename || !renameName.trim()}
          >
            {savingRename ? `${t.save}...` : t.save}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              cancelRenameSection();
            }}
            disabled={savingRename}
          >
            {t.cancel}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="shrink-0 rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              startRenameSection(section);
            }}
          >
            {t.rename}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-500/40 disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteSection(section.id);
            }}
            disabled={!isEmpty || deletingSectionId === section.id}
            title={isEmpty ? undefined : locale === "nb" ? "Seksjonen må være tom" : "Section must be empty"}
          >
            {deletingSectionId === section.id ? `${t.delete}...` : t.delete}
          </button>
        </>
      ),
      content: (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionAddMenu
              open={openAddMenuFor === section.id}
              onOpen={() => setOpenAddMenuFor(section.id)}
              onClose={() => setOpenAddMenuFor(null)}
              onSelectFolder={() => openCreateForm(section.id, "folder")}
              onSelectItem={() => openCreateForm(section.id, "item")}
              showItem={Boolean(items)}
              addLabel={t.addNew}
              folderLabel={t.subfolder}
              itemLabel={t.item}
            />
          </div>

          {sectionFolders.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-textColorThird">{t.foldersHeading}</h4>
              {folderListHeader}
              <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
                {sectionFolders.map((folder) => renderFolderRow(folder))}
              </div>
            </div>
          )}

          {openFolderFormFor === section.id && (
            <div className="rounded-xl border border-lineSecondary p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.name}
                    value={folderFormName}
                    onChange={(e) => setFolderFormName(e.target.value)}
                    disabled={creatingFolder}
                  />
                </div>
                <div className="min-w-[200] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.description}
                    value={folderFormDescription}
                    onChange={(e) => setFolderFormDescription(e.target.value)}
                    disabled={creatingFolder}
                  />
                </div>
                <button
                  type="button"
                  className="customButtonEnabled h-10 px-4"
                  onClick={() => void handleCreateFolderIn(section.id)}
                  disabled={creatingFolder || !folderFormName.trim()}
                >
                  {creatingFolder ? t.creating : t.create}
                </button>
                <button type="button" className="customButtonDefault h-10 px-4" onClick={() => toggleFolderForm(section.id)}>
                  {t.cancel}
                </button>
              </div>
              {folderFormError && <p className="mt-2 text-sm font-medium text-red-600">{folderFormError}</p>}
            </div>
          )}

          {items && (
            <>
              {sectionItems.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-textColorThird">{t.itemsHeading}</h4>
                  {itemListHeader}
                  <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
                    {sectionItems.map((item) => renderItemRow?.(item))}
                  </div>
                </div>
              )}

              {openItemFormFor === section.id && (
                <div className="rounded-xl border border-lineSecondary p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[160] flex-1">
                      <input
                        className="customInput w-full"
                        placeholder={t.name}
                        value={itemFormName}
                        onChange={(e) => setItemFormName(e.target.value)}
                        disabled={creatingItem}
                      />
                    </div>
                    <div className="min-w-[200] flex-1">
                      <input
                        className="customInput w-full"
                        placeholder={t.description}
                        value={itemFormDescription}
                        onChange={(e) => setItemFormDescription(e.target.value)}
                        disabled={creatingItem}
                      />
                    </div>
                    <button
                      type="button"
                      className="customButtonEnabled h-10 px-4"
                      onClick={() => void handleCreateItemIn(section.id)}
                      disabled={creatingItem || !itemFormName.trim()}
                    >
                      {creatingItem ? t.creating : t.create}
                    </button>
                    <button type="button" className="customButtonDefault h-10 px-4" onClick={() => toggleItemForm(section.id)}>
                      {t.cancel}
                    </button>
                  </div>
                  {itemFormError && <p className="mt-2 text-sm font-medium text-red-600">{itemFormError}</p>}
                </div>
              )}
            </>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[1.5rem] font-bold text-logoblue">{t.sections}</h2>

      <div className="mb-4">
        <h3 className="mb-3 text-sm font-semibold text-textColorThird">{t.newSection}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{t.name}</label>
            <input
              className="customInput w-full"
              placeholder={t.name}
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              type="text"
              disabled={creatingSection}
            />
          </div>
          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{t.description}</label>
            <input
              className="customInput w-full"
              placeholder={t.description}
              value={newSectionDescription}
              onChange={(e) => setNewSectionDescription(e.target.value)}
              type="text"
              disabled={creatingSection}
            />
          </div>
          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateSection()}
            disabled={creatingSection || !newSectionName.trim()}
          >
            {creatingSection ? t.creating : t.create}
          </button>
        </div>
        {createSectionError && <p className="mt-3 text-sm font-medium text-red-600">{createSectionError}</p>}
      </div>

      {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}
      {sectionActionError && <p className="mb-4 text-sm font-medium text-red-600">{sectionActionError}</p>}

      {loading && <p className="mb-4 text-sm text-textColorThird">{t.loadingSections}</p>}

      <div className="grid gap-4">
        {panelItems.length > 0 && <ExpandablePanelList items={panelItems} variant="logoblue" />}

        {/* Sections are optional — this bucket is always available, not just
            once there's pre-existing ungrouped content, so a company with no
            sections at all still has a way to create folders/items. */}
        <div className="customContainer border-dashed p-4">
          <h3 className="mb-1 font-semibold text-textColorThird">{t.ungrouped}</h3>
          {sections.length > 0 && ungroupedHasContent && (
            <p className="mb-3 text-sm text-textColorThird">{t.ungroupedHint}</p>
          )}

          <div className="mb-3">
            <SectionAddMenu
              open={openAddMenuFor === UNGROUPED_SECTION_ID}
              onOpen={() => setOpenAddMenuFor(UNGROUPED_SECTION_ID)}
              onClose={() => setOpenAddMenuFor(null)}
              onSelectFolder={() => openCreateForm(UNGROUPED_SECTION_ID, "folder")}
              onSelectItem={() => openCreateForm(UNGROUPED_SECTION_ID, "item")}
              showItem={Boolean(items)}
              addLabel={t.addNew}
              folderLabel={t.subfolder}
              itemLabel={t.item}
            />
          </div>

          {openFolderFormFor === UNGROUPED_SECTION_ID && (
            <div className="mb-3 rounded-xl border border-lineSecondary p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.name}
                    value={folderFormName}
                    onChange={(e) => setFolderFormName(e.target.value)}
                    disabled={creatingFolder}
                  />
                </div>
                <div className="min-w-[200] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.description}
                    value={folderFormDescription}
                    onChange={(e) => setFolderFormDescription(e.target.value)}
                    disabled={creatingFolder}
                  />
                </div>
                <button
                  type="button"
                  className="customButtonEnabled h-10 px-4"
                  onClick={() => void handleCreateFolderIn(UNGROUPED_SECTION_ID)}
                  disabled={creatingFolder || !folderFormName.trim()}
                >
                  {creatingFolder ? t.creating : t.create}
                </button>
                <button
                  type="button"
                  className="customButtonDefault h-10 px-4"
                  onClick={() => toggleFolderForm(UNGROUPED_SECTION_ID)}
                >
                  {t.cancel}
                </button>
              </div>
              {folderFormError && <p className="mt-2 text-sm font-medium text-red-600">{folderFormError}</p>}
            </div>
          )}

          {items && openItemFormFor === UNGROUPED_SECTION_ID && (
            <div className="mb-3 rounded-xl border border-lineSecondary p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.name}
                    value={itemFormName}
                    onChange={(e) => setItemFormName(e.target.value)}
                    disabled={creatingItem}
                  />
                </div>
                <div className="min-w-[200] flex-1">
                  <input
                    className="customInput w-full"
                    placeholder={t.description}
                    value={itemFormDescription}
                    onChange={(e) => setItemFormDescription(e.target.value)}
                    disabled={creatingItem}
                  />
                </div>
                <button
                  type="button"
                  className="customButtonEnabled h-10 px-4"
                  onClick={() => void handleCreateItemIn(UNGROUPED_SECTION_ID)}
                  disabled={creatingItem || !itemFormName.trim()}
                >
                  {creatingItem ? t.creating : t.create}
                </button>
                <button
                  type="button"
                  className="customButtonDefault h-10 px-4"
                  onClick={() => toggleItemForm(UNGROUPED_SECTION_ID)}
                >
                  {t.cancel}
                </button>
              </div>
              {itemFormError && <p className="mt-2 text-sm font-medium text-red-600">{itemFormError}</p>}
            </div>
          )}

          {ungroupedFolders.length === 0 && (!items || ungroupedItems.length === 0) && (
            <p className="text-sm text-textColorThird">{t.ungroupedEmpty}</p>
          )}

          {ungroupedFolders.length > 0 && (
            <div className="mb-3 grid gap-2">
              {ungroupedFolders.map((folder) => (
                <div key={folder.id} className="grid gap-1">
                  {renderFolderRow(folder)}
                  {sections.length > 0 && (
                    <select
                      className="customInput w-fit text-sm"
                      value=""
                      disabled={movingFolderId === folder.id}
                      onChange={(e) => {
                        if (e.target.value) void handleMoveFolder(folder.id, e.target.value);
                      }}
                    >
                      <option value="">{t.moveTo}</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {items && ungroupedItems.length > 0 && (
            <div className="grid gap-1">
              {ungroupedItems.map((item) => (
                <div key={item.id} className="grid gap-1">
                  {renderItemRow?.(item)}
                  {sections.length > 0 && (
                    <select
                      className="customInput w-fit text-sm"
                      value=""
                      disabled={movingItemId === item.id}
                      onChange={(e) => {
                        if (e.target.value) void handleMoveItem(item.id, e.target.value);
                      }}
                    >
                      <option value="">{t.moveTo}</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
