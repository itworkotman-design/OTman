import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import { formatLastModified } from "./types";
import type { ArchiveItemSummary } from "./types";
import { PillHoverActions } from "./PillHoverActions";

type ItemPillProps = {
  item: ArchiveItemSummary;
  href: string;
  locale: string;
  // Hover-reveal rename/edit/delete/share actions — only shown when both
  // are given, i.e. the caller has already gated this on the viewer having
  // archive edit (ADMIN) access.
  canEdit?: boolean;
  onChanged?: () => void;
  // Fixed width (in `ch`) for the leading code, shared across every pill in
  // the same list — see codeBadgeWidthCh in types.ts. Falls back to
  // shrink-wrapping the code's own text when omitted.
  codeWidthCh?: number;
};

// Flush list row, Google Drive-style (top/bottom border only, no side
// borders, no rounding) — the caller wraps a group of these in a single
// divide-y container so adjacent rows share one border line instead of each
// carrying its own box. Used both for pure browsing (FolderView, no
// canEdit/onChanged — no trailing actions at all) and management contexts
// (a folder's settings page, its Sections accordion) where canEdit+onChanged
// add PillHoverActions' rename/archive/delete/copy-link/settings-kebab
// inline. Status itself isn't shown as its own column — it's visible via the
// archive/unarchive icon's state when editable, otherwise only active items
// are ever rendered (see the folder page's filtering). `item.code` is a
// real, stable display code (see lib/docArchive/folderCodes.ts), e.g.
// "1.2F.3" — the containing folder's own code plus this item's local
// sequence number, assigned once at creation and never recomputed from list
// position.
export function ItemPill({ item, href, locale, canEdit, onChanged, codeWidthCh }: ItemPillProps) {
  const hasActions = Boolean(canEdit && onChanged);
  const isArchived = item.status === "archived";

  return (
    <div className={`group/pill flex w-full items-stretch ${isArchived ? "opacity-50 grayscale" : ""}`}>
      <Link
        href={href}
        className="flex min-w-0 grow items-center gap-3 px-2 py-3 transition-colors hover:bg-linePrimary"
      >
        <span
          className={`shrink-0 text-center text-sm font-semibold tabular-nums ${isArchived ? "text-textColorThird" : "text-logoblue"}`}
          style={codeWidthCh ? { minWidth: `${codeWidthCh}ch` } : undefined}
        >
          {item.code}
        </span>

        <span className="min-w-0 shrink-0 wrap-break-word font-medium text-textcolor">{item.name}</span>
        {isArchived && (
          <span className="shrink-0 rounded-full bg-textColorThird px-2 py-0.5 text-xs font-semibold text-white">
            {locale === "nb" ? "Arkivert" : "Archived"}
          </span>
        )}
        {item.description && (
          <span className="min-w-0 truncate text-sm text-textColorThird">{item.description}</span>
        )}
        <span className="ml-auto shrink-0">
          <ConditionBadge flags={item} locale={locale} />
        </span>

        <span className="w-full max-w-[100] shrink-0 text-center text-sm text-textColorThird">
          {formatLastModified(item.updatedAt)}
        </span>
      </Link>

      {hasActions && (
        <PillHoverActions
          kind="item"
          id={item.id}
          name={item.name}
          href={href}
          locale={locale}
          onChanged={onChanged!}
          variant="flat"
          status={item.status}
        />
      )}
    </div>
  );
}
