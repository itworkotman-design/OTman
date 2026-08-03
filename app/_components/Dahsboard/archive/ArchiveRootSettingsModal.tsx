"use client";

import { useState } from "react";
import { EditableEntityRow } from "./EditableEntityRow";
import { SectionedEntityManager } from "./SectionedEntityManager";
import { codeToUrlPath } from "./types";
import type { ArchiveFolderSummary } from "./types";

type ArchiveRootSettingsModalProps = {
  folders: ArchiveFolderSummary[];
  locale: string;
  onCreateFolder: (sectionId: string, name: string, description: string | null) => Promise<{ ok: boolean; reason?: string }>;
  onArchiveFolder: (folderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onFoldersChanged: () => void;
};

// Root-level settings is a modal in the otman-archive prototype
// (SettingsButton/SettingsModal), unlike folder/item settings which are full
// pages — replicated here rather than a route, since there's nothing else
// at the root level to navigate away from.
export function ArchiveRootSettingsModal({
  folders,
  locale,
  onCreateFolder,
  onArchiveFolder,
  onDeleteFolder,
  onFoldersChanged,
}: ArchiveRootSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleArchive(folderId: string) {
    setArchivingId(folderId);
    await onArchiveFolder(folderId);
    setArchivingId(null);
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

            <SectionedEntityManager
              parentFolderId={null}
              locale={locale}
              folders={folders}
              onFoldersChanged={onFoldersChanged}
              onCreateSubfolder={onCreateFolder}
              renderFolderRow={(folder) => (
                <EditableEntityRow
                  key={folder.id}
                  name={folder.name}
                  description={folder.description}
                  status={folder.status}
                  flags={folder}
                  settingsHref={`/dashboard/archive/${codeToUrlPath(folder.code)}/settings`}
                  onArchive={() => void handleArchive(folder.id)}
                  archiving={archivingId === folder.id}
                  onDelete={() => void handleDelete(folder.id)}
                  deleting={deletingId === folder.id}
                  locale={locale}
                />
              )}
            />
          </div>
        </div>
      )}
    </>
  );
}
