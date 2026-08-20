"use client";

import { useEffect, useState } from "react";
import { EntityPill, type PillField } from "./EntityPill";
import { codeBadgeWidthCh, formatLastModified } from "./types";
import type { ArchiveFolderSummary, ArchiveItemSummary } from "./types";

type SharedListResponse = {
  ok?: boolean;
  folders?: ArchiveFolderSummary[];
  items?: ArchiveItemSummary[];
};

const PREVIEW_LIMIT = 5;

function folderHref(folder: ArchiveFolderSummary) {
  return `/dashboard/archive/shared/folder/${folder.id}`;
}

function itemHref(item: ArchiveItemSummary) {
  return `/dashboard/archive/shared/item/${item.id}`;
}

// Google-Drive-style "recently opened" preview of shared-with-me content on
// the archive root page — replaces the old plain link to the standalone
// /dashboard/archive/shared page. Collapsed, it shows the caller's 5
// most-recently-opened shared folders/items (GET .../recent, backed by
// ArchiveSharedRecentOpen — see lib/docArchive/sharedRecentOpens.ts).
// Expanded (via the chevron), it shows the full shared-with-me list in
// place, fetched lazily on first expand — no more separate page navigation.
export function SharedWithYouSection({ locale }: { locale: string }) {
  const [expanded, setExpanded] = useState(false);

  const [previewFolders, setPreviewFolders] = useState<ArchiveFolderSummary[]>([]);
  const [previewItems, setPreviewItems] = useState<ArchiveItemSummary[]>([]);

  const [fullFolders, setFullFolders] = useState<ArchiveFolderSummary[]>([]);
  const [fullItems, setFullItems] = useState<ArchiveItemSummary[]>([]);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/archive/shared-with-me/recent?limit=${PREVIEW_LIMIT}`, { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SharedListResponse | null) => {
        if (cancelled || !data?.ok) return;
        setPreviewFolders(data.folders ?? []);
        setPreviewItems(data.items ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);

    if (next && !fullLoaded) {
      setFullLoading(true);
      fetch("/api/archive/shared-with-me", { credentials: "include", cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: SharedListResponse | null) => {
          if (!data?.ok) return;
          setFullFolders(data.folders ?? []);
          setFullItems(data.items ?? []);
          setFullLoaded(true);
        })
        .catch(() => {})
        .finally(() => setFullLoading(false));
    }
  }

  const activeFolders = (expanded ? fullFolders : previewFolders).filter((folder) => folder.status === "active");
  const activeItems = (expanded ? fullItems : previewItems).filter((item) => item.status === "active");
  const codeWidthCh = codeBadgeWidthCh([...activeFolders.map((f) => f.code), ...activeItems.map((i) => i.code)]);

  const showEmptyMessage = expanded ? fullLoaded && !fullLoading && activeFolders.length === 0 && activeItems.length === 0 : false;

  return (
    <section className="mb-2 w-full max-w-100">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 text-sm text-logoblue hover:underline"
        >
          {locale === "nb" ? "Delt med deg" : "Shared with you"}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {expanded && fullLoading ? (
        <div className="mt-2 text-xs text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</div>
      ) : showEmptyMessage ? (
        <div className="mt-2 text-xs text-textColorThird">
          {locale === "nb" ? "Ingenting er delt med deg ennå" : "Nothing has been shared with you yet"}
        </div>
      ) : activeFolders.length === 0 && activeItems.length === 0 ? null : (
        <div className="mt-2 divide-y divide-lineSecondary border-y border-lineSecondary">
          {activeFolders.map((folder) => (
            <EntityPill
              key={folder.id}
              kind="folder"
              id={folder.id}
              name={folder.name}
              description={folder.description}
              status={folder.status}
              conditionFlags={folder}
              href={folderHref(folder)}
              locale={locale}
              code={folder.code}
              mode="viewer"
              fields={[{ key: "updated", value: formatLastModified(folder.updatedAt) }] satisfies PillField[]}
              codeWidthCh={codeWidthCh}
            />
          ))}
          {activeItems.map((item) => (
            <EntityPill
              key={item.id}
              kind="item"
              id={item.id}
              name={item.name}
              description={item.description}
              status={item.status}
              conditionFlags={item}
              href={itemHref(item)}
              locale={locale}
              code={item.code}
              mode="viewer"
              fields={[{ key: "updated", value: formatLastModified(item.updatedAt) }] satisfies PillField[]}
              codeWidthCh={codeWidthCh}
            />
          ))}
        </div>
      )}
    </section>
  );
}
