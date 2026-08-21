import Link from "next/link";
import type { ReactNode } from "react";
import { ConditionBadge } from "./ConditionBadge";
import { PillActions } from "./PillActions";
import { ShortcutBadge } from "./ShortcutBadge";
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
  // True only for a shortcut's injected display row — draws a small
  // corner-arrow badge over the code so it reads as a pointer at a glance,
  // and tells PillActions to swap in the shortcut action set (Go to source
  // instead of Rename/Archive/Move/Shortcut). See ShortcutEntityModal.
  isShortcut?: boolean;
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
  isShortcut = false,
}: EntityPillProps) {
  const isArchived = status === "archived";
  const isFolder = kind === "folder";

  const rowContent = (
    <>
      <span
        className={`min-w-0 truncate text-sm sm:text-base font-medium ${
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
              className={`relative shrink-0 text-center text-xs sm:text-sm font-semibold tabular-nums ${
                isArchived ? "text-textColorThird" : "text-logoblue"
              }`}
              style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
            >
              {code}
              {isShortcut && (
                <ShortcutBadge className="pointer-events-none absolute -bottom-1 -right-1.5 h-2.5 w-2.5" />
              )}
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
          isShortcut={isShortcut}
          code={code}
        />
      )}
    </div>
  );
}

export type PillHeaderField = { key: string; label: string };

type PillFieldsHeaderProps = {
  kind: "folder" | "item";
  mode: EntityPillMode;
  fields: PillHeaderField[];
  codeWidthCh?: number;
  // Mirrors the row props that decide which actions PillActions renders
  // (see its own "which actions are offered" comment) — a row with
  // onChanged offers rename/archive/move/delete plus the settings kebab, a
  // row with onPinChanged offers the pin star. The header needs an
  // action-column placeholder exactly as wide as the real thing so its
  // field labels line up with the values beneath, so instead of
  // reimplementing that width math it mounts a real (invisible, inert)
  // PillActions with the same shape of props and lets it size itself.
  hasManageActions?: boolean;
  hasPin?: boolean;
  locale: string;
};

function noop() {}

// A label row for the fields EntityPill renders (see PillField) — same kind/
// codeWidthCh/mode as the rows beneath it, empty name/description/condition
// slots (fields already sit flush against the row's right edge via the
// condition badge's `ml-auto`, so nothing before them needs to match), and
// an invisible PillActions clone reserving the same trailing width the real
// hover bar/kebab occupies on every row. Not itself a PillField consumer —
// callers pass `{key, label}` pairs lined up 1:1 with the PillField `key`s
// used on the rows below, in the same order.
export function PillFieldsHeader({ kind, mode, fields, codeWidthCh, hasManageActions = false, hasPin = false, locale }: PillFieldsHeaderProps) {
  return (
    <div className="flex w-full items-stretch text-xs font-semibold uppercase tracking-wide text-textColorThird">
      {kind === "folder" ? (
        <>
          <span
            className="flex shrink-0 items-center justify-center px-1.5 sm:px-2 text-xs sm:text-sm font-semibold"
            style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
            aria-hidden="true"
          />
          <div className="flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3">
            <span className="ml-auto hidden shrink-0 sm:block" aria-hidden="true" />
            {fields.map((field) => (
              <span key={field.key} className="hidden w-full max-w-[100] shrink-0 text-center sm:block">
                {field.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 grow items-center gap-2 sm:gap-3 px-2 py-2 sm:py-3">
          <span
            className="shrink-0 text-center text-xs sm:text-sm font-semibold tabular-nums"
            style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
            aria-hidden="true"
          />
          <span className="ml-auto hidden shrink-0 sm:block" aria-hidden="true" />
          {fields.map((field) => (
            <span key={field.key} className="hidden w-full max-w-[100] shrink-0 text-center sm:block">
              {field.label}
            </span>
          ))}
        </div>
      )}

      {mode === "admin" && (
        <div className="invisible" aria-hidden="true">
          <PillActions
            kind={kind}
            id="header"
            name=""
            href=""
            locale={locale}
            canEdit
            onChanged={hasManageActions ? noop : undefined}
            status={hasManageActions ? "active" : undefined}
            isPinned={hasPin ? false : undefined}
            onPinChanged={hasPin ? noop : undefined}
          />
        </div>
      )}
    </div>
  );
}
