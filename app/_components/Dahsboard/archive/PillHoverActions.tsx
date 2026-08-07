"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

type PillHoverActionsProps = {
  kind: "folder" | "item";
  id: string;
  name: string;
  // The pill's own link path (e.g. "/dashboard/archive/1/2F") — the share
  // button copies `location.origin + href`, not the API resource, and the
  // settings kebab links to `${href}/settings`.
  href: string;
  locale: string;
  // Re-fetches the parent view's folders/items list after a delete, since
  // the pill itself doesn't own that list.
  onChanged: () => void;
  // "pill" (default) matches FolderPill's bordered rounded-4xl trailing
  // zone. "flat" drops the border/rounding entirely for ItemPill's
  // Google Drive-style list row, where the row itself has no side borders.
  variant?: "pill" | "flat";
  // Current status — when given, an Archive/Unarchive toggle button renders
  // alongside rename/delete/share, self-contained the same way delete is
  // (PATCHes status directly, then calls onChanged). Omitted by callers with
  // nowhere sensible for a status toggle (e.g. the archive root page's plain
  // browsing list, which never passes canEdit/onChanged at all anyway).
  status?: string;
};

const ICON_BUTTON_CLASS =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-logoblue transition-all duration-150 hover:bg-logoblue/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100";

function IconSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function PencilIcon() {
  return (
    <IconSvg>
      <path d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3z" />
    </IconSvg>
  );
}

function TrashIcon() {
  return (
    <IconSvg>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </IconSvg>
  );
}

function ArchiveIcon() {
  return (
    <IconSvg>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </IconSvg>
  );
}

function LinkIcon() {
  return (
    <IconSvg>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </IconSvg>
  );
}

function CheckIcon() {
  return (
    <IconSvg>
      <path d="M20 6 9 17l-5-5" />
    </IconSvg>
  );
}

// Always-visible affordance pinned to the far right — filled rather than
// stroked so it reads as distinct from the hover-only action icons next to
// it. Links straight to the folder/item's settings page.
function DotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

// Permanent trailing zone on a folder/item pill (see FolderPill/ItemPill) —
// only rendered for archive editors (module access level "ADMIN"); a
// non-editor's pill is completely unchanged, no reserved space at all. The
// kebab at the far right is always visible and links straight to the
// folder/item's settings page — that page IS the edit surface, so there's no
// separate inline "Edit" popover here. On hover of the whole pill
// (`group/pill`), the rename/delete/share buttons fade in to the kebab's
// left. "Rename" has no backing capability in the archive package yet (only
// status/dates/section can be changed — see EntitySettingsPanel's file-top
// comment), so it's shown disabled rather than omitted, as a placeholder for
// when that lands.
export function PillHoverActions({
  kind,
  id,
  name,
  href,
  locale,
  onChanged,
  variant = "pill",
  status,
}: PillHoverActionsProps) {
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copied, setCopied] = useState(false);

  const basePath = kind === "folder" ? `/api/archive/folders/${id}` : `/api/archive/items/${id}`;

  async function handleToggleArchive(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!status) return;

    const nextStatus = status === "archived" ? "active" : "archived";

    try {
      setArchiving(true);
      const res = await fetch(`${basePath}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) onChanged();
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmMessage =
      kind === "folder"
        ? locale === "nb"
          ? `Slette mappen "${name}"?`
          : `Delete the folder "${name}"?`
        : locale === "nb"
          ? `Slette elementet "${name}"?`
          : `Delete the item "${name}"?`;
    if (!confirm(confirmMessage)) return;

    try {
      setDeleting(true);
      const res = await fetch(basePath, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) onChanged();
    } finally {
      setDeleting(false);
    }
  }

  async function handleCopyLink(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied/unavailable — no fallback needed, the
      // button just silently doesn't show the "Copied!" confirmation.
    }
  }

  return (
    <div
      className={`flex w-52 shrink-0 items-center justify-end gap-1 px-3 ${
        variant === "pill" ? "rounded-r-4xl border border-l-0 border-logoblue" : ""
      }`}
    >
      {/* Hovered state: fades in to the left of the always-visible kebab. */}
      <div className="pointer-events-none flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/pill:pointer-events-auto group-hover/pill:opacity-100">
        <button
          type="button"
          className={ICON_BUTTON_CLASS}
          disabled
          title={locale === "nb" ? "Kommer snart" : "Coming soon"}
          aria-label={locale === "nb" ? "Gi nytt navn (kommer snart)" : "Rename (coming soon)"}
        >
          <PencilIcon />
        </button>

        {status && (
          <button
            type="button"
            className={ICON_BUTTON_CLASS}
            onClick={(e) => void handleToggleArchive(e)}
            disabled={archiving}
            title={
              status === "archived"
                ? locale === "nb"
                  ? "Gjenåpne"
                  : "Unarchive"
                : locale === "nb"
                  ? "Arkiver"
                  : "Archive"
            }
            aria-label={
              status === "archived"
                ? locale === "nb"
                  ? "Gjenåpne"
                  : "Unarchive"
                : locale === "nb"
                  ? "Arkiver"
                  : "Archive"
            }
          >
            <ArchiveIcon />
          </button>
        )}

        <button
          type="button"
          className={ICON_BUTTON_CLASS}
          onClick={(e) => void handleDelete(e)}
          disabled={deleting}
          title={locale === "nb" ? "Slett" : "Delete"}
          aria-label={locale === "nb" ? "Slett" : "Delete"}
        >
          <TrashIcon />
        </button>

        <button
          type="button"
          className={`${ICON_BUTTON_CLASS} ${copied ? "bg-green-500/15 text-green-600 hover:bg-green-500/15" : ""}`}
          onClick={(e) => void handleCopyLink(e)}
          title={copied ? (locale === "nb" ? "Kopiert!" : "Copied!") : locale === "nb" ? "Kopier lenke" : "Copy link"}
          aria-label={locale === "nb" ? "Kopier lenke" : "Copy link"}
        >
          {copied ? <CheckIcon /> : <LinkIcon />}
        </button>
      </div>

      {/* Always visible: goes straight to this folder/item's settings page. */}
      <Link
        href={`${href}/settings`}
        className={ICON_BUTTON_CLASS}
        title={locale === "nb" ? "Innstillinger" : "Settings"}
        aria-label={locale === "nb" ? "Innstillinger" : "Settings"}
      >
        <DotsIcon />
      </Link>
    </div>
  );
}
