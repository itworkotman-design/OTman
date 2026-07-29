import Link from "next/link";
import type { ArchiveFolderSummary } from "./types";

type FolderPillProps = {
  folder: ArchiveFolderSummary;
  href: string;
};

// Matches the otman-archive prototype's SectionPill "lastModified" column
// format (dot-separated, 2-digit year, e.g. "29.07.26") rather than a
// locale-dependent Intl format — this is a fixed display convention, not a
// translated string.
function formatLastModified(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
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
export function FolderPill({ folder, href }: FolderPillProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-stretch overflow-hidden rounded-4xl border border-logoblue font-semibold transition-colors hover:bg-logoblue/5"
    >
      <div className="flex min-w-14 shrink-0 items-center justify-center bg-logoblue px-3 py-6 text-base text-white">
        {folder.code}
      </div>

      <div className="min-w-0 grow wrap-break-word border-r border-logoblue px-6 py-6 text-[1.25rem] leading-tight text-logoblue">
        {folder.name}
      </div>

      <div className="flex w-full max-w-[100] shrink-0 items-center justify-center border-r border-logoblue py-6 text-center text-sm text-textColorThird">
        {folder.entryCount}
      </div>

      <div className="flex w-full max-w-[100] shrink-0 items-center justify-center border-r border-logoblue py-6 text-center text-sm text-textColorThird">
        {folder.viewerCount}
      </div>

      <div className="flex w-full max-w-[100] shrink-0 items-center justify-center py-6 text-center text-sm text-textColorThird">
        {formatLastModified(folder.updatedAt)}
      </div>
    </Link>
  );
}
