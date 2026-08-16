"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { MoveEntityModal } from "@/app/_components/Dahsboard/archive/MoveEntityModal";

type PillHoverActionsProps = {
  kind: "folder" | "item";
  id: string;
  name: string;
  // The pill's own link path (e.g. "/dashboard/archive/1/2F") — the share
  // button copies `location.origin + href`, not the API resource, and the
  // settings kebab links to `${href}/settings`.
  href: string;
  locale: string;
  // Every "settings" action — pin, rename, archive-toggle, move, delete, and
  // the settings kebab itself — is admin-only. Copy Link is the one
  // exception: it always renders regardless of canEdit, so any viewer with
  // archive access (not just admins) gets it. This component now always
  // mounts (FolderPill/ItemPill no longer gate its presence on canEdit) —
  // canEdit just controls how much of it shows.
  canEdit: boolean;
  // Re-fetches the parent view's folders/items list after a mutation, since
  // the pill itself doesn't own that list. Only meaningful (and only
  // required in practice) when canEdit is true; callers with nowhere
  // sensible for admin actions (e.g. the archive root page's plain browsing
  // list) can omit it — the kebab/rename/archive/move/delete buttons stay
  // hidden without it even if canEdit is true, same as they were hidden
  // outright before this component always-mounted.
  onChanged?: () => void;
  // "pill" (default) matches FolderPill's bordered rounded-4xl trailing
  // zone. "flat" drops the border/rounding entirely for ItemPill's
  // Google Drive-style list row, where the row itself has no side borders.
  variant?: "pill" | "flat";
  // Current status — when given, an Archive/Unarchive toggle button renders
  // alongside rename/delete/share, self-contained the same way delete is
  // (PATCHes status directly, then calls onChanged).
  status?: string;
  // Backed by the package's real per-user pinFolder/unpinFolder or
  // pinItem/unpinItem (0.2.0 delivery) — the star renders only when both
  // canEdit and onPinChanged are given, so callers with nowhere sensible for
  // pinning (e.g. the root settings modal's management rows) just omit
  // onPinChanged.
  isPinned?: boolean;
  onPinChanged?: () => void;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5z" />
    </svg>
  );
}

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

function MoveIcon() {
  return (
    <IconSvg>
      <path d="M5 9V5a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 12v5m0-5 2.5 2.5M12 12l-2.5 2.5" />
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
// mounted for every row regardless of access level, but everything inside
// except Copy Link is admin-only: the kebab (links straight to the
// folder/item's settings page — that page IS the edit surface, so there's no
// separate inline "Edit" popover here), and on hover of the whole pill
// (`group/pill`), the pin/rename/archive/move/delete buttons that fade in to
// the kebab's left. A non-editor's pill still gets the reserved trailing
// zone, just with only Copy Link inside it. The inline "Rename" pencil here
// has no backing capability in the archive package's list-row surface yet
// (rename is real now via EntitySettingsPanel's Details tab, just not from
// this row) — shown disabled rather than omitted, still admin-only.
export function PillHoverActions({
  kind,
  id,
  name,
  href,
  locale,
  canEdit,
  onChanged,
  variant = "pill",
  status,
  isPinned,
  onPinChanged,
}: PillHoverActionsProps) {
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [pinning, setPinning] = useState(false);

  const basePath = kind === "folder" ? `/api/archive/folders/${id}` : `/api/archive/items/${id}`;

  async function handleTogglePin(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pinning) return;

    try {
      setPinning(true);
      const res = await fetch(`${basePath}/pin`, {
        method: isPinned ? "DELETE" : "POST",
        credentials: "include",
      });
      if (res.ok) onPinChanged?.();
    } finally {
      setPinning(false);
    }
  }

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
      if (res.ok && data?.ok) onChanged?.();
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
      if (res.ok && data?.ok) onChanged?.();
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

  // The full CRUD bundle (rename/archive/move/delete) and the settings
  // kebab are admin-only AND need somewhere to report a mutation back to —
  // callers that pass canEdit without onChanged (none currently do, but the
  // types allow it) get neither. Pin is gated on canEdit alone (paired with
  // its own onPinChanged, independent of the CRUD bundle's onChanged) since
  // a pin toggle doesn't need the parent list refetched the way a
  // rename/delete/move does.
  const canManage = canEdit && Boolean(onChanged);
  const showPin = canEdit && Boolean(onPinChanged);

  return (
    <div
      className={`flex w-52 shrink-0 items-center justify-end gap-1 px-3 ${
        variant === "pill" ? "rounded-r-4xl border border-l-0 border-logoblue" : ""
      }`}
    >
      {/* Hovered state: fades in to the left of the always-visible kebab
          (when canManage — otherwise this only ever holds Copy Link). */}
      <div className="pointer-events-none flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/pill:pointer-events-auto group-hover/pill:opacity-100">
        {showPin && (
          <button
            type="button"
            className={`${ICON_BUTTON_CLASS} ${isPinned ? "text-logoblue" : ""}`}
            onClick={(e) => void handleTogglePin(e)}
            disabled={pinning}
            title={
              isPinned
                ? locale === "nb"
                  ? "Fjern fest"
                  : "Unpin"
                : locale === "nb"
                  ? kind === "folder"
                    ? "Fest mappe"
                    : "Fest element"
                  : kind === "folder"
                    ? "Pin folder"
                    : "Pin item"
            }
            aria-label={
              isPinned
                ? locale === "nb"
                  ? "Fjern fest"
                  : "Unpin"
                : locale === "nb"
                  ? kind === "folder"
                    ? "Fest mappe"
                    : "Fest element"
                  : kind === "folder"
                    ? "Pin folder"
                    : "Pin item"
            }
            aria-pressed={isPinned}
          >
            <StarIcon filled={Boolean(isPinned)} />
          </button>
        )}

        {canManage && (
          <>
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMoveModalOpen(true);
              }}
              title={locale === "nb" ? "Flytt til mappe" : "Move to folder"}
              aria-label={locale === "nb" ? "Flytt til mappe" : "Move to folder"}
            >
              <MoveIcon />
            </button>

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
          </>
        )}

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

      {/* Always visible when canManage: goes straight to this folder/item's
          settings page. Hidden entirely for non-admins/no-onChanged rows —
          the settings page is the edit surface, so there's no reason to
          link to it otherwise. */}
      {canManage && (
        <Link
          href={`${href}/settings`}
          className={ICON_BUTTON_CLASS}
          title={locale === "nb" ? "Innstillinger" : "Settings"}
          aria-label={locale === "nb" ? "Innstillinger" : "Settings"}
        >
          <DotsIcon />
        </Link>
      )}

      {moveModalOpen && onChanged && (
        <MoveEntityModal
          kind={kind}
          entityId={id}
          entityName={name}
          locale={locale}
          onClose={() => setMoveModalOpen(false)}
          onMoved={onChanged}
        />
      )}
    </div>
  );
}
