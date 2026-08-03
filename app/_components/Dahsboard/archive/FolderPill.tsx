import Link from "next/link";
import { formatLastModified } from "./types";
import type { ArchiveFolderSummary } from "./types";

type FolderPillProps = {
  folder: ArchiveFolderSummary;
  href: string;
  showDescription?: boolean;
  // The archive root page shows entries/viewer-count columns (a tenant-wide
  // overview); inside a folder's own view (per-section subfolder/item
  // lists) those columns are dropped and only the last-modified date shows,
  // to match the plainer per-section pill layout there.
  showStats?: boolean;
};

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
export function FolderPill({ folder, href, showDescription = true, showStats = true }: FolderPillProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-stretch overflow-hidden rounded-4xl border border-logoblue font-semibold transition-colors hover:bg-logoblue/5"
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

      <div className="flex w-full max-w-[100] shrink-0 items-center justify-center py-3 text-center text-sm text-textColorThird">
        {formatLastModified(folder.updatedAt)}
      </div>
    </Link>
  );
}
