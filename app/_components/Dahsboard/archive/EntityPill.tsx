import Link from "next/link";
import type { ReactNode } from "react";
import { ConditionBadge } from "./ConditionBadge";
import { PillActions } from "./PillActions";
import type { ArchiveBusinessStatus, ArchiveConditionFlags } from "./types";

// A caller-supplied value column (entries/users/updated/…). EntityPill only
// reserves a same-sized slot per field and renders whatever node is given —
// it has no idea what "entries" or "users" mean, or how many of them there
// are; the caller decides which fields exist and computes their values.
export type PillField = {
  key: string;
  value: ReactNode;
};

// "admin" mounts PillActions (the hover bar / mobile "..." menu — see
// PillActions.tsx); "viewer" renders the plain row with nothing trailing,
// letting the value columns use the width an admin row would reserve for
// actions.
export type EntityPillMode = "admin" | "viewer";

type EntityPillProps = {
  kind: "folder" | "item";
  id: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  conditionFlags: ArchiveConditionFlags;
  href: string;
  locale: string;
  // `code` is a real, stable display code (see lib/docArchive/folderCodes.ts):
  // for folders, root folders are plain numbers ("1"), every folder below
  // root gets its own local number suffixed "F" ("1.2F"); items get their
  // containing folder's code plus a local sequence number ("1.2F.3"),
  // assigned once at creation and never recomputed from list position — so
  // deleting a sibling never renumbers the ones around it.
  code: string;
  // Fixed width (in `ch`) for the leading code/badge, shared across every
  // pill in the same list — see codeBadgeWidthCh in types.ts. Falls back to
  // shrink-wrapping the code's own text when omitted.
  codeWidthCh?: number;
  showDescription?: boolean;
  mode: EntityPillMode;
  fields?: PillField[];
  // Only meaningful (and only required in practice) when mode is "admin" —
  // gates the rename/archive/move/delete/settings bundle in PillActions.
  onChanged?: () => void;
  // Backed by the package's real per-user pinFolder/unpinFolder (0.2.0
  // delivery). Pinning is a root-level-folder feature only, by product
  // decision — items never pass this, and neither does a folder row inside
  // a folder's own view/settings (only the root archive page's top-level
  // folder list and its Pinned folders section do). Also admin-only, so
  // this only does anything when mode is "admin" too.
  showFavorite?: boolean;
  isPinned?: boolean;
  onPinChanged?: () => void;
};

// Single component for both folders and items, in both admin and viewer
// contexts — every list in the archive (root, a folder's own view, a
// folder's settings subfolder/item lists, pinned folders, pinned items) uses
// this. Flush list row, Google Drive-style (top/bottom border only, no side
// borders, no rounding) — the caller wraps a group of these in one divide-y
// container so adjacent rows share a single border line instead of each
// carrying its own box. The blue badge background + blue name are the only
// deliberate visual differences for folders vs items, so folders stay easy
// to pick out at a glance in a mixed folder/item list. Status itself isn't
// its own column — visible via the archive/unarchive action's state in admin
// mode, otherwise only active items are ever rendered by the caller.
export function EntityPill({
  kind,
  id,
  name,
  description,
  status,
  conditionFlags,
  href,
  locale,
  code,
  codeWidthCh,
  showDescription = true,
  mode,
  fields = [],
  onChanged,
  showFavorite = false,
  isPinned = false,
  onPinChanged,
}: EntityPillProps) {
  const isArchived = status === "archived";
  const isFolder = kind === "folder";

  const rowContent = (
    <>
      <span
        className={`min-w-0 shrink-0 wrap-break-word text-sm sm:text-base font-medium ${
          isFolder ? (isArchived ? "text-textColorThird" : "text-logoblue") : "text-textcolor"
        }`}
      >
        {name}
      </span>
      {isArchived && (
        <span className="shrink-0 rounded-full bg-textColorThird px-2 py-0.5 text-xs font-semibold text-white">
          {locale === "nb" ? "Arkivert" : "Archived"}
        </span>
      )}
      {showDescription && description && (
        <span className="hidden min-w-0 truncate text-xs sm:inline sm:text-sm text-textColorThird">{description}</span>
      )}

      <span className="ml-auto hidden shrink-0 sm:block">
        <ConditionBadge flags={conditionFlags} locale={locale} />
      </span>

      {fields.map((field) => (
        <span key={field.key} className="hidden w-full max-w-[100] shrink-0 text-center text-sm sm:block text-textColorThird">
          {field.value}
        </span>
      ))}
    </>
  );

  return (
    <div className={`group/pill flex w-full items-stretch ${isArchived ? "opacity-50 grayscale" : ""}`}>
      <Link
        href={href}
        className={
          isFolder
            ? "flex min-w-0 grow items-stretch transition-colors hover:bg-linePrimary"
            : "flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3 transition-colors hover:bg-linePrimary"
        }
      >
        {isFolder ? (
          <>
            <span
              className={`flex shrink-0 items-center justify-center px-1.5 sm:px-2 text-xs sm:text-sm font-semibold tabular-nums text-white ${
                isArchived ? "bg-textColorThird" : "bg-logoblue"
              }`}
              style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
            >
              {code}
            </span>
            <div className="flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3">{rowContent}</div>
          </>
        ) : (
          <>
            <span
              className={`shrink-0 text-center text-xs sm:text-sm font-semibold tabular-nums ${
                isArchived ? "text-textColorThird" : "text-logoblue"
              }`}
              style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
            >
              {code}
            </span>
            {rowContent}
          </>
        )}
      </Link>

      {mode === "admin" && (
        <PillActions
          kind={kind}
          id={id}
          name={name}
          href={href}
          locale={locale}
          canEdit
          onChanged={onChanged}
          status={status}
          isPinned={showFavorite ? isPinned : undefined}
          onPinChanged={showFavorite ? onPinChanged : undefined}
        />
      )}
    </div>
  );
}
