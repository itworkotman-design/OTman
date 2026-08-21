"use client";

import { useEffect, useState } from "react";
import { groupBySection } from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveSectionSummary } from "@/app/_components/Dahsboard/archive/types";

type BreadcrumbEntry = { id: string | null; name: string };

type SubmitResult = { ok: true } | { ok: false; reason?: string };

type DestinationPickerProps = {
  // Only "folder" ever triggers the self-exclusion filter below — passing
  // "item" is already a no-op there, so callers that only ever move/shortcut
  // items (e.g. ShortcutEntityModal) can safely hardcode "item".
  kind: "item" | "folder";
  entityId: string;
  entityName: string;
  locale: string;
  title: string;
  confirmHereLabel: string;
  createAndConfirmLabel: string;
  creatingAndConfirmingLabel: string;
  onClose: () => void;
  onSubmit: (folderId: string, sectionId: string | null) => Promise<SubmitResult>;
  errorText: (reason: string | undefined) => string;
  onSuccess: () => void;
};

// Destination picker — deliberately mirrors the real archive browsing UI
// (breadcrumb + section-grouped folder list, drill in/out) rather than a
// search box, per explicit user request, with two steps: first browse to and
// pick a *folder*, then optionally pick a *section* inside it — sections are
// optional, same as creating something there directly, so there's always an
// "Ungrouped" choice alongside the destination's real sections. The archive
// root itself is never a selectable destination (see moveFolder.ts's
// file-top comment on why root moves were removed) — you can only browse
// through it to reach a real folder. Shared by MoveEntityModal and
// ShortcutEntityModal — the only difference between the two is what
// `onSubmit` actually does with the chosen (folderId, sectionId).
export function DestinationPicker({
  kind,
  entityId,
  entityName,
  locale,
  title,
  confirmHereLabel,
  createAndConfirmLabel,
  creatingAndConfirmingLabel,
  onClose,
  onSubmit,
  errorText,
  onSuccess,
}: DestinationPickerProps) {
  const [path, setPath] = useState<BreadcrumbEntry[]>([{ id: null, name: locale === "nb" ? "Arkiv" : "Archive" }]);
  const currentFolderId = path[path.length - 1].id;
  const atRoot = currentFolderId === null;

  const [folders, setFolders] = useState<ArchiveFolderSummary[]>([]);
  const [sections, setSections] = useState<ArchiveSectionSummary[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(true);
  const [browseError, setBrowseError] = useState("");

  const [destination, setDestination] = useState<{ id: string; name: string } | null>(null);
  const [destinationSections, setDestinationSections] = useState<ArchiveSectionSummary[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoadingBrowse(true);
        setBrowseError("");

        const foldersUrl = currentFolderId ? `/api/archive/folders/${currentFolderId}/children` : "/api/archive/folders";
        const sectionsUrl = currentFolderId ? `/api/archive/folders/${currentFolderId}/sections` : "/api/archive/sections";

        const [foldersRes, sectionsRes] = await Promise.all([
          fetch(foldersUrl, { credentials: "include", cache: "no-store" }),
          fetch(sectionsUrl, { credentials: "include", cache: "no-store" }),
        ]);
        const foldersData = await foldersRes.json().catch(() => null);
        const sectionsData = await sectionsRes.json().catch(() => null);
        if (cancelled) return;

        if (!foldersRes.ok || !foldersData?.ok) {
          setBrowseError(foldersData?.reason || "Failed to load folders");
          setFolders([]);
          return;
        }

        // Exclude the folder being moved from its own parent's listing —
        // besides being a nonsensical destination, this also makes every
        // one of its descendants unreachable via drill-down (they can only
        // be reached by navigating through their ancestor, which is now
        // hidden), so no separate client-side cycle-filtering is needed.
        const list: ArchiveFolderSummary[] = (foldersData.folders ?? []).filter(
          (f: ArchiveFolderSummary) => !(kind === "folder" && f.id === entityId),
        );
        setFolders(list);
        if (sectionsRes.ok && sectionsData?.ok) setSections(sectionsData.sections ?? []);
      } catch {
        if (!cancelled) {
          setBrowseError("Failed to load folders");
          setFolders([]);
        }
      } finally {
        if (!cancelled) setLoadingBrowse(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentFolderId, kind, entityId]);

  function enterFolder(folder: ArchiveFolderSummary) {
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function jumpTo(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
  }

  async function chooseDestination() {
    if (!currentFolderId) return;
    const name = path[path.length - 1].name;
    setDestination({ id: currentFolderId, name });
    setError("");

    try {
      setLoadingSections(true);
      const res = await fetch(`/api/archive/folders/${currentFolderId}/sections`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) setDestinationSections(data.sections ?? []);
    } finally {
      setLoadingSections(false);
    }
  }

  function backToBrowse() {
    setDestination(null);
    setDestinationSections([]);
    setNewSectionName("");
    setNewSectionDescription("");
    setError("");
  }

  async function submit(sectionId: string | null) {
    if (!destination) return;
    try {
      setSubmitting(true);
      setError("");

      const result = await onSubmit(destination.id, sectionId);
      if (!result.ok) {
        setError(errorText(result.reason));
        return;
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSectionAndSubmit() {
    if (!destination) return;
    const name = newSectionName.trim();
    if (!name) return;

    try {
      setCreatingSection(true);
      setError("");

      const res = await fetch(`/api/archive/folders/${destination.id}/sections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newSectionDescription.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.section?.id) {
        setError(locale === "nb" ? "Kunne ikke opprette seksjon" : "Failed to create section");
        return;
      }

      await submit(data.section.id);
    } finally {
      setCreatingSection(false);
    }
  }

  const groups = groupBySection(folders, sections, locale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-bold text-textcolor">
            {title} &ldquo;{entityName}&rdquo;
          </h2>
          <button type="button" className="customButtonDefault shrink-0" onClick={onClose}>
            {locale === "nb" ? "Lukk" : "Close"}
          </button>
        </div>

        {!destination ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-textColorThird">
              {path.map((entry, index) => (
                <span key={index} className="flex items-center gap-1">
                  {index > 0 && <span>/</span>}
                  {index === path.length - 1 ? (
                    <span className="font-semibold text-textcolor">{entry.name}</span>
                  ) : (
                    <button type="button" className="hover:underline" onClick={() => jumpTo(index)}>
                      {entry.name}
                    </button>
                  )}
                </span>
              ))}
            </div>

            {!atRoot && (
              <button type="button" className="customButtonEnabled mb-3 self-start" onClick={() => void chooseDestination()}>
                {confirmHereLabel}
              </button>
            )}

            <div className="scrollbar-always min-h-0 flex-1 overflow-y-auto">
              {loadingBrowse ? (
                <p className="py-4 text-center text-sm text-textColorThird">
                  {locale === "nb" ? "Laster..." : "Loading..."}
                </p>
              ) : browseError ? (
                <p className="py-4 text-center text-sm font-medium text-red-600">{browseError}</p>
              ) : folders.length === 0 ? (
                <p className="py-4 text-center text-sm text-textColorThird">
                  {locale === "nb" ? "Ingen undermapper" : "No subfolders"}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {groups.map((group) => (
                    <div key={group.id}>
                      {group.name && (
                        <h3 className="mb-2 text-sm font-semibold text-logoblue">{group.name}</h3>
                      )}
                      <div className="flex flex-col gap-2">
                        {group.entries.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            className="flex items-stretch overflow-hidden rounded-xl border border-lineSecondary text-left transition-colors hover:border-logoblue hover:bg-linePrimary/40"
                            onClick={() => enterFolder(folder)}
                          >
                            <span className="flex shrink-0 items-center justify-center bg-logoblue px-2.5 text-xs font-semibold tabular-nums text-white">
                              {folder.code}
                            </span>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2">
                              <span className="min-w-0 truncate font-medium text-logoblue">{folder.name}</span>
                              <span className="shrink-0 text-textColorThird">›</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mb-3 self-start text-sm text-logoblue hover:underline"
              onClick={backToBrowse}
            >
              {locale === "nb" ? "← Velg en annen mappe" : "← Choose a different folder"}
            </button>
            <p className="mb-3 text-sm text-textColorThird">
              {locale === "nb" ? "Velg en seksjon i" : "Choose a section in"}{" "}
              <span className="font-semibold text-textcolor">{destination.name}</span>{" "}
              {locale === "nb" ? "(valgfritt)" : "(optional)"}
            </p>

            {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

            <div className="scrollbar-always min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-lineSecondary px-4 py-3 text-left font-semibold text-textcolor transition-colors hover:border-logoblue disabled:opacity-50"
                  onClick={() => void submit(null)}
                  disabled={submitting || creatingSection}
                >
                  {locale === "nb" ? "Ugruppert (ingen seksjon)" : "Ungrouped (no section)"}
                </button>

                {loadingSections ? (
                  <p className="py-4 text-center text-sm text-textColorThird">
                    {locale === "nb" ? "Laster..." : "Loading..."}
                  </p>
                ) : (
                  destinationSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className="rounded-xl bg-logoblue px-4 py-3 text-left font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
                      onClick={() => void submit(section.id)}
                      disabled={submitting || creatingSection}
                    >
                      {section.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 border-t border-lineSecondary pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
                {locale === "nb" ? "Ny seksjon" : "New section"}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder={locale === "nb" ? "Navn" : "Name"}
                  className="customInput min-w-[140] flex-1"
                  disabled={creatingSection || submitting}
                />
                <input
                  type="text"
                  value={newSectionDescription}
                  onChange={(e) => setNewSectionDescription(e.target.value)}
                  placeholder={locale === "nb" ? "Beskrivelse (valgfritt)" : "Description (optional)"}
                  className="customInput min-w-[160] flex-1"
                  disabled={creatingSection || submitting}
                />
                <button
                  type="button"
                  className="customButtonEnabled h-10 px-4"
                  onClick={() => void handleCreateSectionAndSubmit()}
                  disabled={creatingSection || submitting || !newSectionName.trim()}
                >
                  {creatingSection ? creatingAndConfirmingLabel : createAndConfirmLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
