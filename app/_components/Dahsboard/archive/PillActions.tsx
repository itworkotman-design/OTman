"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { MoveEntityModal } from "@/app/_components/Dahsboard/archive/MoveEntityModal";
import { RenameEntityModal } from "@/app/_components/Dahsboard/archive/RenameEntityModal";
import { ShortcutEntityModal } from "@/app/_components/Dahsboard/archive/ShortcutEntityModal";
import { codeToUrlPath } from "@/app/_components/Dahsboard/archive/types";

type PillActionsProps = {
  kind: "folder" | "item";
  id: string;
  name: string;
  // The pill's own link path (e.g. "/dashboard/archive/1/2F") — the share
  // button copies `location.origin + href`, not the API resource, and the
  // settings kebab links to `${href}/settings`.
  href: string;
  locale: string;
  // Every action in here — pin, rename, archive-toggle, move, delete,
  // settings, and Copy Link — is admin-only. EntityPill only mounts this
  // component at all when its mode is "admin"; this prop is always true in
  // practice, kept as an explicit prop rather than assumed so the gating
  // stays visible at the call site.
  canEdit: boolean;
  // Re-fetches the parent view's folders/items list after a mutation, since
  // the pill itself doesn't own that list. Only meaningful (and only
  // required in practice) when canEdit is true; callers with nowhere
  // sensible for admin actions (e.g. the archive root page's plain browsing
  // list) can omit it — the rename/archive/move/delete/settings actions stay
  // hidden without it even if canEdit is true.
  onChanged?: () => void;
  // Current status — when given, an Archive/Unarchive toggle action is
  // available alongside rename/delete/share, self-contained the same way
  // delete is (PATCHes status directly, then calls onChanged).
  status?: string;
  // Backed by the package's real per-user pinFolder/unpinFolder or
  // pinItem/unpinItem (0.2.0 delivery) — the pin action is only offered when
  // both canEdit and onPinChanged are given, so callers with nowhere
  // sensible for pinning (e.g. the root settings modal's management rows)
  // just omit onPinChanged.
  isPinned?: boolean;
  onPinChanged?: () => void;
  // True only for a shortcut's injected display row — swaps the action set
  // to Go-to-source (plus Delete/Copy-link) instead of the real-item CRUD
  // bundle, since this row is a pointer, not the real item. `code` is the
  // SOURCE item's own real dotted code, needed to build the Go-to-source
  // link (present on every item pill, real or shortcut).
  isShortcut?: boolean;
  code?: string;
};

type PillAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
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

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-textcolor transition-colors hover:bg-linePrimary disabled:cursor-not-allowed disabled:opacity-40";

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

function ShortcutPlusIcon() {
  return (
    <IconSvg>
      <path d="M13 7h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-3" />
      <path d="M4 15V6a2 2 0 0 1 2-2h4l2 2" />
      <path d="M9 15l6-6m0 0h-4m4 0v4" />
    </IconSvg>
  );
}

function GoToSourceIcon() {
  return (
    <IconSvg>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </IconSvg>
  );
}

// Filled rather than stroked so it reads as distinct from the stroked action
// icons — used both as the always-visible settings link (desktop) and the
// "more actions" menu trigger (mobile).
function DotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

// Trailing action zone on a folder/item pill (see EntityPill) — everything
// inside is admin-only, so EntityPill only mounts this at all when its mode
// is "admin". Two independent presentations of the same underlying action
// list, one visible at a time by breakpoint:
//   - Desktop (sm and up): a hover-reveal icon bar to the left of an
//     always-visible settings kebab. Every icon is always mounted (opacity
//     toggled, not display) so the bar's own intrinsic width already grows
//     or shrinks with however many actions are actually available — there's
//     no fixed width to keep in sync as actions are added or removed.
//   - Mobile (below sm): a single "..." trigger that opens a dropdown
//     listing the same actions as text rows, since hover has no equivalent
//     on touch.
// Rename opens RenameEntityModal (matching this row's other modal action,
// MoveEntityModal) rather than an inline input — not meant to replace
// EntitySettingsPanel's Details tab for anything fancier.
export function PillActions({ kind, id, name, href, locale, canEdit, onChanged, status, isPinned, onPinChanged, isShortcut, code }: PillActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen]);

  // A shortcut row's `id` is the shortcut row's OWN id (never the real
  // item's — see listInjectedShortcuts), so pointing Delete at
  // /api/archive/shortcuts/{id} here is what makes it remove only the
  // pointer, never the real item — handleDelete below needs no other change.
  const basePath =
    kind === "folder" ? `/api/archive/folders/${id}` : isShortcut ? `/api/archive/shortcuts/${id}` : `/api/archive/items/${id}`;

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
        : isShortcut
          ? locale === "nb"
            ? `Fjerne snarveien til "${name}"?`
            : `Remove this shortcut to "${name}"?`
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

  function handleRename(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenameModalOpen(true);
  }

  function handleMove(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMoveModalOpen(true);
  }

  function handleAddShortcut(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShortcutModalOpen(true);
  }

  function handleGoToSource(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (code) router.push(`/dashboard/archive/${codeToUrlPath(code)}`);
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
      // button/menu item just silently doesn't show the "Copied!" state.
    }
  }

  // The full CRUD bundle (rename/archive/move/delete) and the settings link
  // are admin-only AND need somewhere to report a mutation back to —
  // callers that pass canEdit without onChanged (e.g. PinnedFoldersSection,
  // which has nowhere sensible to send a rename/delete refetch) get neither.
  // Pin is gated on canEdit alone (paired with its own onPinChanged,
  // independent of the CRUD bundle's onChanged) since a pin toggle doesn't
  // need the parent list refetched the way a rename/delete/move does.
  const canManage = canEdit && Boolean(onChanged);
  const showPin = canEdit && Boolean(onPinChanged) && !isShortcut;
  // Rename/Archive/Move/Shortcut/Pin/Settings all act on the REAL item — a
  // shortcut pill represents "the real item, as seen from here", so none of
  // those are offered on it (mutating the real item from a pointer, with no
  // visual cue the mutation reaches back to its actual home, is confusing).
  // Delete stays available on shortcuts (it only ever removes the pointer —
  // see basePath above); Go to source is offered instead of the rest.
  const canManageMutations = canManage && !isShortcut;

  const pinLabel = isPinned
    ? locale === "nb"
      ? "Fjern fest"
      : "Unpin"
    : locale === "nb"
      ? kind === "folder"
        ? "Fest mappe"
        : "Fest element"
      : kind === "folder"
        ? "Pin folder"
        : "Pin item";
  const renameLabel = locale === "nb" ? "Gi nytt navn" : "Rename";
  const archiveLabel =
    status === "archived" ? (locale === "nb" ? "Gjenåpne" : "Unarchive") : locale === "nb" ? "Arkiver" : "Archive";
  const moveLabel = locale === "nb" ? "Flytt til mappe" : "Move to folder";
  const shortcutLabel = locale === "nb" ? "Legg til snarvei" : "Add shortcut";
  const goToSourceLabel = locale === "nb" ? "Gå til kilden" : "Go to source";
  const deleteLabel = isShortcut ? (locale === "nb" ? "Fjern snarvei" : "Remove shortcut") : locale === "nb" ? "Slett" : "Delete";
  const copyLabel = copied ? (locale === "nb" ? "Kopiert!" : "Copied!") : locale === "nb" ? "Kopier lenke" : "Copy link";
  const settingsLabel = locale === "nb" ? "Innstillinger" : "Settings";
  const moreLabel = locale === "nb" ? "Flere handlinger" : "More actions";

  // Single source of truth for what's offered, driving both the desktop
  // hover bar and the mobile dropdown — add/remove an action here and both
  // presentations (and the desktop bar's intrinsic width) follow.
  const actions: PillAction[] = [];
  if (showPin) actions.push({ key: "pin", label: pinLabel, icon: <StarIcon filled={Boolean(isPinned)} />, onClick: handleTogglePin, disabled: pinning, active: isPinned });
  if (canManageMutations) {
    actions.push({ key: "rename", label: renameLabel, icon: <PencilIcon />, onClick: handleRename });
    if (status) actions.push({ key: "archive", label: archiveLabel, icon: <ArchiveIcon />, onClick: handleToggleArchive, disabled: archiving });
    actions.push({ key: "move", label: moveLabel, icon: <MoveIcon />, onClick: handleMove });
    if (kind === "item") actions.push({ key: "shortcut", label: shortcutLabel, icon: <ShortcutPlusIcon />, onClick: handleAddShortcut });
  }
  if (canManage) actions.push({ key: "delete", label: deleteLabel, icon: <TrashIcon />, onClick: handleDelete, disabled: deleting });
  if (isShortcut && code) actions.push({ key: "go-to-source", label: goToSourceLabel, icon: <GoToSourceIcon />, onClick: handleGoToSource });
  if (canEdit) actions.push({ key: "copy", label: copyLabel, icon: copied ? <CheckIcon /> : <LinkIcon />, onClick: handleCopyLink, active: copied });

  return (
    <div className="flex shrink-0 items-center">
      {/* Desktop: fade in to the left of the always-visible settings kebab
          (when canManage — otherwise this bar is just the hover-revealed
          actions with no kebab). A shortcut row has no settings kebab to
          fall back on (canManageMutations is always false for it — see
          above), so its actions stay permanently visible instead of
          hover-only, or Delete/Go-to-source would have no visible affordance
          at all outside of a hover. */}
      <div className="hidden shrink-0 items-center gap-1 px-3 sm:flex">
        <div
          className={
            isShortcut
              ? "flex items-center gap-1"
              : "pointer-events-none flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/pill:pointer-events-auto group-hover/pill:opacity-100"
          }
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={`${ICON_BUTTON_CLASS} ${action.active ? "text-logoblue" : ""} ${
                action.key === "copy" && copied ? "bg-green-500/15 text-green-600 hover:bg-green-500/15" : ""
              }`}
              onClick={(e) => void action.onClick(e)}
              disabled={action.disabled}
              title={action.label}
              aria-label={action.label}
              aria-pressed={action.key === "pin" ? isPinned : undefined}
            >
              {action.icon}
            </button>
          ))}
        </div>

        {canManageMutations && (
          <Link href={`${href}/settings`} className={ICON_BUTTON_CLASS} title={settingsLabel} aria-label={settingsLabel}>
            <DotsIcon />
          </Link>
        )}
      </div>

      {/* Mobile: one tap target opens a dropdown with the same actions as
          text rows, since hover-reveal has no touch equivalent. */}
      <div ref={menuRef} className="relative shrink-0 px-3 sm:hidden">
        <button
          type="button"
          className={ICON_BUTTON_CLASS}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMobileMenuOpen((open) => !open);
          }}
          title={moreLabel}
          aria-label={moreLabel}
          aria-expanded={mobileMenuOpen}
        >
          <DotsIcon />
        </button>

        {mobileMenuOpen && (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-20 w-48 overflow-hidden rounded-2xl border border-lineSecondary bg-white text-left shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={MENU_ITEM_CLASS}
                disabled={action.disabled}
                onClick={(e) => {
                  action.onClick(e);
                  setMobileMenuOpen(false);
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            {canManageMutations && (
              <Link href={`${href}/settings`} className={MENU_ITEM_CLASS} onClick={() => setMobileMenuOpen(false)}>
                <DotsIcon />
                {settingsLabel}
              </Link>
            )}
          </div>
        )}
      </div>

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

      {renameModalOpen && onChanged && (
        <RenameEntityModal
          kind={kind}
          entityId={id}
          currentName={name}
          locale={locale}
          onClose={() => setRenameModalOpen(false)}
          onRenamed={onChanged}
        />
      )}

      {shortcutModalOpen && onChanged && (
        <ShortcutEntityModal
          itemId={id}
          itemName={name}
          locale={locale}
          onClose={() => setShortcutModalOpen(false)}
          onShortcutCreated={onChanged}
        />
      )}
    </div>
  );
}
