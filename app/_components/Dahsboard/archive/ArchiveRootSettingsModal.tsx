"use client";

import { useState } from "react";
import { EntityPill, PillFieldsHeader, type PillField, type PillHeaderField } from "./EntityPill";
import { SectionedEntityManager } from "./SectionedEntityManager";
import { SettingsIcon, settingsIconButtonClass } from "./SettingsIcon";
import { codeToUrlPath, formatLastModified, pillFieldLabel } from "./types";
import type { ArchiveFolderSummary } from "./types";

type ArchiveRootSettingsModalProps = {
  folders: ArchiveFolderSummary[];
  locale: string;
  onCreateFolder: (sectionId: string | null, name: string, description: string | null) => Promise<{ ok: boolean; reason?: string }>;
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

  const headerFields: PillHeaderField[] = [
    { key: "entries", label: pillFieldLabel("entries", locale) },
    { key: "users", label: pillFieldLabel("users", locale) },
    { key: "updated", label: pillFieldLabel("updated", locale) },
  ];

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
            // Sized to its content (fit-content) rather than a fixed
            // max-width — the folder rows inside (code badge + name +
            // condition badge + entries/users/updated columns + the actions
            // gutter, see EntityPill/PillActions) can genuinely need more
            // than the old max-w-2xl (672px) allowed, which forced them to
            // bleed out of the modal instead of wrapping (several of their
            // spans are deliberately shrink-0). min-w keeps it from
            // collapsing too small for the plain create-section form —
            // doubled from the original min-w-md (28rem) since three field
            // columns plus the actions gutter were still getting squished
            // into that floor, with the hover-actions bar overlapping the
            // Updated column instead of sitting clear of it; max-w keeps it
            // comfortably inside the viewport on any window size;
            // overflow-x-auto is a last-resort contained scroll for content
            // that's still wider than that cap, instead of bleeding onto the
            // page.
            className="scrollbar-always max-h-[80vh] w-fit min-w-4xl max-w-[92vw] overflow-auto rounded-3xl bg-white p-8 shadow-lg animate-dialog-content-show"
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
              folderListHeader={<PillFieldsHeader kind="folder" mode="admin" locale={locale} hasManageActions fields={headerFields} />}
              renderFolderRow={(folder) => (
                <EntityPill
                  key={folder.id}
                  kind="folder"
                  id={folder.id}
                  name={folder.name}
                  description={folder.description}
                  status={folder.status}
                  conditionFlags={folder}
                  href={`/dashboard/archive/${codeToUrlPath(folder.code)}`}
                  locale={locale}
                  code={folder.code}
                  mode="admin"
                  fields={
                    [
                      { key: "entries", value: folder.entryCount },
                      { key: "users", value: folder.viewerCount },
                      { key: "updated", value: formatLastModified(folder.updatedAt) },
                    ] satisfies PillField[]
                  }
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
