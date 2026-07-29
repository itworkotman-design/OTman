"use client";

import { useState } from "react";
import { EditableEntityRow } from "./EditableEntityRow";
import type { ArchiveFolderSummary } from "./types";

type ArchiveRootSettingsModalProps = {
  folders: ArchiveFolderSummary[];
  locale: string;
  onCreateFolder: (name: string, description: string | null) => Promise<{ ok: boolean; reason?: string }>;
  onDeleteFolder: (folderId: string) => Promise<void>;
};

// Root-level settings is a modal in the otman-archive prototype
// (SettingsButton/SettingsModal), unlike folder/item settings which are full
// pages — replicated here rather than a route, since there's nothing else
// at the root level to navigate away from.
export function ArchiveRootSettingsModal({ folders, locale, onCreateFolder, onDeleteFolder }: ArchiveRootSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    setCreateError("");

    const result = await onCreateFolder(trimmed, description.trim() || null);

    if (!result.ok) {
      setCreateError(result.reason || "Failed to create folder");
    } else {
      setName("");
      setDescription("");
    }

    setCreating(false);
  }

  async function handleDelete(folderId: string) {
    if (!confirm(locale === "nb" ? "Slette denne mappen?" : "Delete this folder?")) return;

    setDeletingId(folderId);
    await onDeleteFolder(folderId);
    setDeletingId(null);
  }

  return (
    <>
      <button type="button" className="customButtonDefault" onClick={() => setIsOpen(true)}>
        {locale === "nb" ? "Innstillinger" : "Settings"}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center animate-dialog-overlay-show"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-lg animate-dialog-content-show"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[1.5rem] font-bold text-logoblue">{locale === "nb" ? "Innstillinger" : "Settings"}</h2>
              <button type="button" onClick={() => setIsOpen(false)} className="customButtonDefault">
                ✕
              </button>
            </div>

            <div className="mb-2 flex flex-wrap items-end gap-3">
              <div className="min-w-[200] flex-1">
                <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
                <input
                  className="customInput w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  disabled={creating}
                />
              </div>

              <div className="min-w-[240] flex-1">
                <label className="block pb-2 text-sm">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
                <input
                  className="customInput w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  type="text"
                  disabled={creating}
                />
              </div>

              <button
                type="button"
                className="customButtonEnabled h-10 px-6"
                onClick={() => void handleCreate()}
                disabled={creating || !name.trim()}
              >
                {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
              </button>
            </div>

            {createError && <p className="mb-4 text-sm font-medium text-red-600">{createError}</p>}

            <div className="mt-4 flex flex-col gap-3">
              {folders.length === 0 ? (
                <p className="text-sm text-textColorThird">{locale === "nb" ? "Ingen mapper" : "No folders"}</p>
              ) : (
                folders.map((folder) => (
                  <EditableEntityRow
                    key={folder.id}
                    name={folder.name}
                    description={folder.description}
                    status={folder.status}
                    flags={folder}
                    settingsHref={`/dashboard/archive/${folder.id}/settings`}
                    onDelete={() => void handleDelete(folder.id)}
                    deleting={deletingId === folder.id}
                    locale={locale}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
