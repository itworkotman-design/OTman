import Link from "next/link";
import { useState } from "react";
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
  // Hover-reveal rename/edit/delete/share actions — only shown when both
  // are given, i.e. the caller has already gated this on the viewer having
  // archive edit (ADMIN) access.
  canEdit?: boolean;
  onChanged?: () => void;
  // Archive root page only, gated the same way as `canEdit` (ADMIN-level
  // module access). No backend field for this exists yet — purely local
  // component state, resets on reload, by explicit design for now.
  showFavorite?: boolean;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
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

// Ported from the otman-archive prototype's ArchiveSectionItem/SectionPill —
// same blue bordered row, leading code badge, bold name, right-side info
// columns. `folder.code` is a real, stable display code (see
// lib/docArchive/folderCodes.ts): root folders are plain numbers ("1"),
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
}: FolderPillProps) {
  const hasActions = Boolean(canEdit && onChanged);
  const hasTrailingZone = hasActions || showFavorite;
  const [favorited, setFavorited] = useState(false);

  return (
    <div className="group/pill flex w-full items-stretch font-semibold">
      <Link
        href={href}
        className={`flex min-w-0 grow items-stretch overflow-hidden border border-logoblue transition-colors hover:bg-logoblue/5 ${
          hasTrailingZone ? "rounded-l-4xl border-r-0" : "rounded-4xl"
        }`}
      >
        <div className="flex min-w-12 shrink-0 items-center justify-center bg-logoblue px-2 py-3 text-base text-white">
          {folder.code}
        </div>

        <div className="flex min-w-0 grow items-baseline gap-3 border-r border-logoblue px-4 py-3 text-logoblue">
          <span className="shrink-0 wrap-break-word text-[1.25rem] leading-tight">{folder.name}</span>
          {showDescription && folder.description && (
            <span className="min-w-0 truncate text-sm font-normal text-textColorThird">{folder.description}</span>
          )}
        </div>

        {showStats && (
          <>
            <div className="flex w-full max-w-[100] shrink-0 items-center justify-center border-r border-logoblue py-3 text-center text-sm text-textColorThird">
              {folder.entryCount}
            </div>

            <div className="flex w-full max-w-[100] shrink-0 items-center justify-center border-r border-logoblue py-3 text-center text-sm text-textColorThird">
              {folder.viewerCount}
            </div>
          </>
        )}

        <div
          className={`flex w-full max-w-[100] shrink-0 items-center justify-center py-3 text-center text-sm text-textColorThird ${
            hasTrailingZone ? "border-r border-logoblue" : ""
          }`}
        >
          {formatLastModified(folder.updatedAt)}
        </div>
      </Link>

      {showFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setFavorited((v) => !v);
          }}
          className={`flex w-12 shrink-0 items-center justify-center border border-l-0 border-logoblue ${
            hasActions ? "" : "rounded-r-4xl"
          } ${favorited ? "text-logoblue" : "text-textColorThird hover:text-logoblue"}`}
          title={
            favorited
              ? locale === "nb"
                ? "Fjern favoritt"
                : "Remove favorite"
              : locale === "nb"
                ? "Legg til favoritt"
                : "Add favorite"
          }
          aria-label={favorited ? (locale === "nb" ? "Fjern favoritt" : "Remove favorite") : locale === "nb" ? "Legg til favoritt" : "Add favorite"}
          aria-pressed={favorited}
        >
          <StarIcon filled={favorited} />
        </button>
      )}

      {hasActions && (
        <PillHoverActions
          kind="folder"
          id={folder.id}
          name={folder.name}
          href={href}
          locale={locale}
          onChanged={onChanged!}
        />
      )}
    </div>
  );
}
