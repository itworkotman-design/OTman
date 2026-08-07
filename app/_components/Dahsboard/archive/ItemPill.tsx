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
};

// Read-only row for item view pages — no settings icon, no delete, matching
// FolderPill's visual style (same rounded-4xl bordered pill, leading code
// badge, name column) rather than the old rounded-full mini pill inside a
// collapsible per-status panel. Editing/deleting an item happens on the
// containing folder's settings page (EditableEntityRow), not here. Status
// itself isn't shown here either — this view only ever renders active items
// (see the folder page's filtering), and status is changed via settings.
// `item.code` is a real, stable display code (see lib/docArchive/folderCodes.ts),
// e.g. "1.2F.3" — the containing folder's own code plus this item's local
// sequence number, assigned once at creation and never recomputed from list
// position, matching the otman-archive prototype's SectionPill leading code
// badge.
export function ItemPill({ item, href, locale, canEdit, onChanged }: ItemPillProps) {
  const hasActions = Boolean(canEdit && onChanged);

  return (
    <div className="group/pill flex w-full items-stretch font-semibold">
      <Link
        href={href}
        className={`flex min-w-0 grow items-stretch overflow-hidden border border-logoblue transition-colors hover:bg-logoblue/5 ${
          hasActions ? "rounded-l-4xl border-r-0" : "rounded-4xl"
        }`}
      >
        <div className="flex min-w-12 shrink-0 items-center justify-center bg-logoblue px-2 py-3 text-base text-white">
          {item.code}
        </div>

        <div className="flex min-w-0 grow items-center gap-3 border-r border-logoblue px-4 py-3 text-logoblue">
          <span className="shrink-0 wrap-break-word text-[1.25rem] leading-tight">{item.name}</span>
          {item.description && (
            <span className="min-w-0 truncate text-sm font-normal text-textColorThird">{item.description}</span>
          )}
          <span className="ml-auto shrink-0">
            <ConditionBadge flags={item} locale={locale} />
          </span>
        </div>

        <div
          className={`flex w-full max-w-[100] shrink-0 items-center justify-center py-3 text-center text-sm text-textColorThird ${
            hasActions ? "border-r border-logoblue" : ""
          }`}
        >
          {formatLastModified(item.updatedAt)}
        </div>
      </Link>

      {hasActions && (
        <PillHoverActions
          kind="item"
          id={item.id}
          name={item.name}
          href={href}
          locale={locale}
          onChanged={onChanged!}
        />
      )}
    </div>
  );
}
