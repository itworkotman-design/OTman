import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import { formatLastModified } from "./types";
import type { ArchiveItemSummary } from "./types";
import { PillHoverActions } from "./PillHoverActions";

type ItemPillProps = {
  item: ArchiveItemSummary;
  href: string;
  locale: string;
  // Every action in the trailing hover zone (rename/archive/move/delete/pin/
  // settings-kebab) is admin-only — see PillHoverActions, which this always
  // mounts now. Copy Link is the one exception and shows for any viewer
  // regardless of canEdit. onChanged is only needed for the CRUD bundle
  // (rename/archive/move/delete); pinning uses its own onPinChanged instead.
  canEdit?: boolean;
  onChanged?: () => void;
  // Backed by the package's real per-user pinItem/unpinItem (0.2.0
  // delivery) — isPinned/onPinChanged are passed straight through to
  // PillHoverActions, which only actually renders the star when canEdit is
  // also true (pinning is admin-only, same as everything else here besides
  // Copy Link).
  showFavorite?: boolean;
  isPinned?: boolean;
  onPinChanged?: () => void;
  // Fixed width (in `ch`) for the leading code, shared across every pill in
  // the same list — see codeBadgeWidthCh in types.ts. Falls back to
  // shrink-wrapping the code's own text when omitted.
  codeWidthCh?: number;
};

// Flush list row, Google Drive-style (top/bottom border only, no side
// borders, no rounding) — the caller wraps a group of these in a single
// divide-y container so adjacent rows share one border line instead of each
// carrying its own box. Used both for pure browsing (FolderView, no
// canEdit/onChanged — no admin actions, just Copy Link) and management
// contexts (a folder's settings page, its Sections accordion) where
// canEdit+onChanged add PillHoverActions' full rename/archive/delete/pin/
// settings-kebab bundle alongside Copy Link. Status itself isn't shown as
// its own column — it's visible via the archive/unarchive icon's state when
// editable, otherwise only active items are ever rendered (see the folder
// page's filtering). `item.code` is a real, stable display code (see
// lib/docArchive/folderCodes.ts), e.g. "1.2F.3" — the containing folder's
// own code plus this item's local sequence number, assigned once at
// creation and never recomputed from list position.
export function ItemPill({
  item,
  href,
  locale,
  canEdit,
  onChanged,
  showFavorite = false,
  isPinned = false,
  onPinChanged,
  codeWidthCh,
}: ItemPillProps) {
  const isArchived = item.status === "archived";

  return (
    <div className={`group/pill flex w-full items-stretch ${isArchived ? "opacity-50 grayscale" : ""}`}>
      <Link
        href={href}
        className="flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3 transition-colors hover:bg-linePrimary"
      >
        <span
          className={`shrink-0 text-center text-xs sm:text-sm font-semibold tabular-nums ${isArchived ? "text-textColorThird" : "text-logoblue"}`}
          style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
        >
          {item.code}
        </span>

        <span className="min-w-0 shrink-0 wrap-break-word text-sm sm:text-base font-medium text-textcolor">{item.name}</span>
        {isArchived && (
          <span className="shrink-0 rounded-full bg-textColorThird px-2 py-0.5 text-xs font-semibold text-white">
            {locale === "nb" ? "Arkivert" : "Archived"}
          </span>
        )}
        {item.description && (
          <span className="hidden min-w-0 truncate text-xs sm:inline sm:text-sm text-textColorThird">{item.description}</span>
        )}
        <span className="ml-auto hidden shrink-0 sm:block">
          <ConditionBadge flags={item} locale={locale} />
        </span>

        <span className="hidden w-full max-w-[100] shrink-0 text-center text-sm sm:block text-textColorThird">
          {formatLastModified(item.updatedAt)}
        </span>
      </Link>

      <PillHoverActions
        kind="item"
        id={item.id}
        name={item.name}
        href={href}
        locale={locale}
        canEdit={Boolean(canEdit)}
        onChanged={onChanged}
        variant="flat"
        status={item.status}
        isPinned={showFavorite ? isPinned : undefined}
        onPinChanged={showFavorite ? onPinChanged : undefined}
      />
    </div>
  );
}
