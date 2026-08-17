"use client";

import { useEffect, useState } from "react";
import { EntityPill, type PillField } from "./EntityPill";
import { codeBadgeWidthCh, codeToUrlPath, formatLastModified } from "./types";
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
// contents. `canEdit` is threaded through to EntityPill's mode, which gates
// the unpin action on it — pinning is admin-only, so a non-admin viewer's
// own pinned list (always empty, since they can never create a pin) would
// show no pin action anyway, but this keeps the gate explicit rather than
// relying on that side effect. Uses the same EntityPill every other folder
// list in the archive does — pinned folders are not a special case, so
// `onChanged` gives every row here the same full rename/archive/move/delete/
// settings bundle a main-list row gets, not just pin/unpin. The root page
// passes the same handler for both onChanged and onPinChanged since either
// one needs to refresh both this section and the main folder list.
export function PinnedFoldersSection({
  locale,
  canEdit,
  refreshKey,
  onChanged,
  onPinChanged,
}: {
  locale: string;
  canEdit: boolean;
  refreshKey: number;
  onChanged: () => void;
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
        {folders.map((folder) => {
          const fields: PillField[] = [{ key: "entries", value: folder.entryCount }];
          if (canEdit) fields.push({ key: "users", value: folder.viewerCount });
          fields.push({ key: "updated", value: formatLastModified(folder.updatedAt) });

          return (
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
              showDescription={false}
              mode={canEdit ? "admin" : "viewer"}
              fields={fields}
              onChanged={onChanged}
              showFavorite
              isPinned
              onPinChanged={onPinChanged}
              codeWidthCh={codeWidthCh}
            />
          );
        })}
      </div>
    </section>
  );
}
