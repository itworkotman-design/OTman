import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import { formatLastModified } from "./types";
import type { ArchiveItemSummary } from "./types";

type ItemPillProps = {
  item: ArchiveItemSummary;
  href: string;
  locale: string;
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
export function ItemPill({ item, href, locale }: ItemPillProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-stretch overflow-hidden rounded-4xl border border-logoblue font-semibold transition-colors hover:bg-logoblue/5"
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

      <div className="flex w-full max-w-[100] shrink-0 items-center justify-center py-3 text-center text-sm text-textColorThird">
        {formatLastModified(item.updatedAt)}
      </div>
    </Link>
  );
}
