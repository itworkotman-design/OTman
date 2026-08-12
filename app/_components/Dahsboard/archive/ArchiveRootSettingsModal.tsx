"use client";

import { useState } from "react";
import { FolderPill } from "./FolderPill";
import { SectionedEntityManager } from "./SectionedEntityManager";
import { SettingsIcon, settingsIconButtonClass } from "./SettingsIcon";
import { codeToUrlPath } from "./types";
import type { ArchiveFolderSummary } from "./types";

type ArchiveRootSettingsModalProps = {
  folders: ArchiveFolderSummary[];
  locale: string;
  onCreateFolder: (sectionId: string, name: string, description: string | null) => Promise<{ ok: boolean; reason?: string }>;
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
  onFoldersChanged,
}: ArchiveRootSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={locale === "nb" ? "Innstillinger" : "Settings"}
        title={locale === "nb" ? "Innstillinger" : "Settings"}
        className={settingsIconButtonClass}
        onClick={() => setIsOpen(true)}
      >
        <SettingsIcon />
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
                <FolderPill
                  key={folder.id}
                  folder={folder}
                  href={`/dashboard/archive/${codeToUrlPath(folder.code)}`}
                  locale={locale}
                  showStats={false}
                  canEdit
                  onChanged={onFoldersChanged}
                />
              )}
            />
          </div>
        </div>
      )}
    </>
  );
}
