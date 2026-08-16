"use client";

import { useEffect, useState } from "react";
import { FolderPill } from "./FolderPill";
import { codeBadgeWidthCh, codeToUrlPath } from "./types";
import type { ArchiveFolderSummary } from "./types";

type PinnedFoldersResponse = {
  ok?: boolean;
  folders?: ArchiveFolderSummary[];
  reason?: string;
};

// Real per-user pinning (0.2.0 delivery — pinFolder/unpinFolder/
// listPinnedFolders) replaces the earlier disabled "Coming soon" placeholder.
// `refreshKey` lets the root page force a refetch after a pin toggle
// elsewhere on the page (the main folder list) changes this section's
// contents. `canEdit` is threaded through to FolderPill's PillHoverActions,
// which gates the unpin star on it — pinning is admin-only, so a non-admin
// viewer's own pinned list (always empty, since they can never create a
// pin) would show no star anyway, but this keeps the gate explicit rather
// than relying on that side effect.
export function PinnedFoldersSection({
  locale,
  canEdit,
  refreshKey,
  onPinChanged,
}: {
  locale: string;
  canEdit: boolean;
  refreshKey: number;
  onPinChanged: () => void;
}) {
  const [folders, setFolders] = useState<ArchiveFolderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPinnedFolders() {
      setLoading(true);
      try {
        const res = await fetch("/api/archive/pinned-folders", { method: "GET", credentials: "include", cache: "no-store" });
        const data = (await res.json().catch(() => null)) as PinnedFoldersResponse | null;
        if (!cancelled) setFolders(data?.ok ? (data.folders ?? []) : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPinnedFolders();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return null;
  if (folders.length === 0) return null;

  const codeWidthCh = codeBadgeWidthCh(folders.map((f) => f.code), 5);

  return (
    <section className="my-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[2rem] font-bold text-logoblue">{locale === "nb" ? "Festede mapper" : "Pinned folders"}</h2>
      </div>
      <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
        {folders.map((folder) => (
          <FolderPill
            key={folder.id}
            folder={folder}
            href={`/dashboard/archive/${codeToUrlPath(folder.code)}`}
            locale={locale}
            showDescription={false}
            canEdit={canEdit}
            showFavorite
            isPinned
            onPinChanged={onPinChanged}
            codeWidthCh={codeWidthCh}
          />
        ))}
      </div>
    </section>
  );
}
