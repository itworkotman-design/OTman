import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import { formatLastModified } from "./types";
import type { ArchiveFolderSummary } from "./types";
import { PillHoverActions } from "./PillHoverActions";

type FolderPillProps = {
  folder: ArchiveFolderSummary;
  href: string;
  locale: string;
  showDescription?: boolean;
  // The archive root page shows entries/viewer-count columns (a tenant-wide
  // overview); inside a folder's own view (per-section subfolder/item
  // lists) those columns are dropped and only the last-modified date shows,
  // to match the plainer per-section pill layout there.
  showStats?: boolean;
  // Every action in the trailing hover zone (rename/archive/move/delete/pin/
  // settings-kebab) is admin-only — see PillHoverActions, which this always
  // mounts now. Copy Link is the one exception and shows for any viewer
  // regardless of canEdit. onChanged is only needed for the CRUD bundle
  // (rename/archive/move/delete); pinning uses its own onPinChanged instead.
  canEdit?: boolean;
  onChanged?: () => void;
  // Backed by the package's real per-user pinFolder/unpinFolder (0.2.0
  // delivery) — isPinned/onPinChanged are passed straight through to
  // PillHoverActions, which only actually renders the star when canEdit is
  // also true (pinning is admin-only, same as everything else here besides
  // Copy Link).
  showFavorite?: boolean;
  isPinned?: boolean;
  onPinChanged?: () => void;
  // Fixed width (in `ch`) for the leading code badge, shared across every
  // pill in the same list — see codeBadgeWidthCh in types.ts. Falls back to
  // shrink-wrapping the badge's own text when omitted.
  codeWidthCh?: number;
};

// Flush list row, same Google Drive-style shape as ItemPill (no side
// borders, no rounding, no gap to its neighbors — the caller wraps a group
// of these in a shared divide-y container). The blue background behind the
// code is the one deliberate difference from ItemPill, so folders stay easy
// to pick out at a glance in a mixed folder/item list; the name also stays
// blue for the same reason. `folder.code` is a real, stable display code
// (see lib/docArchive/folderCodes.ts): root folders are plain numbers ("1"),
// every folder below root gets its own local number suffixed "F" ("1.2F"),
// assigned once at creation and never recomputed from list position — so
// deleting a sibling never renumbers the ones around it. `entries`/`users`
// are real computed values too (see lib/docArchive/folderStats.ts): entries
// = this folder's own items plus every descendant folder's items,
// recursively; users = distinct platform users with effective `view` access
// to the folder (direct rule, role membership, or inherited from an
// ancestor folder). Status/due-date editing still lives on the folder's
// settings page — dropped from this row to match the prototype's layout.
export function FolderPill({
  folder,
  href,
  locale,
  showDescription = true,
  showStats = true,
  canEdit,
  onChanged,
  showFavorite = false,
  isPinned = false,
  onPinChanged,
  codeWidthCh,
}: FolderPillProps) {
  const isArchived = folder.status === "archived";

  return (
    <div className={`group/pill flex w-full items-stretch ${isArchived ? "opacity-50 grayscale" : ""}`}>
      <Link href={href} className="flex min-w-0 grow items-stretch transition-colors hover:bg-linePrimary">
        <span
          className={`flex shrink-0 items-center justify-center px-1.5 sm:px-2 text-xs sm:text-sm font-semibold tabular-nums text-white ${
            isArchived ? "bg-textColorThird" : "bg-logoblue"
          }`}
          style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
        >
          {folder.code}
        </span>

        <div className="flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3">
          <span
            className={`min-w-0 shrink-0 wrap-break-word text-sm sm:text-base font-medium ${isArchived ? "text-textColorThird" : "text-logoblue"}`}
          >
            {folder.name}
          </span>
          {isArchived && (
            <span className="shrink-0 rounded-full bg-textColorThird px-2 py-0.5 text-xs font-semibold text-white">
              {locale === "nb" ? "Arkivert" : "Archived"}
            </span>
          )}
          {showDescription && folder.description && (
            <span className="hidden min-w-0 truncate text-xs sm:inline sm:text-sm text-textColorThird">{folder.description}</span>
          )}

          <span className="ml-auto hidden shrink-0 sm:block">
            <ConditionBadge flags={folder} locale={locale} />
          </span>

          {showStats && (
            <>
              <span className="hidden w-full max-w-[100] shrink-0 text-center text-sm sm:block text-textColorThird">
                {folder.entryCount}
              </span>

              <span className="hidden w-full max-w-[100] shrink-0 text-center text-sm sm:block text-textColorThird">
                {folder.viewerCount}
              </span>
            </>
          )}

          <span className="hidden w-full max-w-[100] shrink-0 text-center text-sm sm:block text-textColorThird">
            {formatLastModified(folder.updatedAt)}
          </span>
        </div>
      </Link>

      <PillHoverActions
        kind="folder"
        id={folder.id}
        name={folder.name}
        href={href}
        locale={locale}
        canEdit={Boolean(canEdit)}
        onChanged={onChanged}
        variant="flat"
        status={folder.status}
        isPinned={showFavorite ? isPinned : undefined}
        onPinChanged={showFavorite ? onPinChanged : undefined}
      />
    </div>
  );
}
