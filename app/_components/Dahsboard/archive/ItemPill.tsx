import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import type { ArchiveItemSummary } from "./types";

type ItemPillProps = {
  item: ArchiveItemSummary;
  href: string;
  locale: string;
};

const statusLabel: Record<ArchiveItemSummary["status"], { en: string; nb: string }> = {
  active: { en: "Active", nb: "Aktiv" },
  inactive: { en: "Inactive", nb: "Inaktiv" },
  draft: { en: "Draft", nb: "Utkast" },
  archived: { en: "Archived", nb: "Arkivert" },
};

// Read-only row for item view pages — no settings icon, no delete, matching
// FolderPill's visual style. Editing/deleting an item happens on the
// containing folder's settings page (EditableEntityRow), not here.
// `item.code` is a real, stable display code (see lib/docArchive/folderCodes.ts),
// e.g. "1.2F.3" — the containing folder's own code plus this item's local
// sequence number, assigned once at creation and never recomputed from list
// position, matching the otman-archive prototype's SectionPill leading code
// badge.
export function ItemPill({ item, href, locale }: ItemPillProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-4 overflow-hidden rounded-full border border-lineSecondary px-4 py-2 font-semibold shadow-sm transition-colors hover:bg-logoblue/5"
    >
      <span className="shrink-0 rounded-full bg-logoblue px-3 py-1 text-xs text-white">{item.code}</span>

      <div className="min-w-0 grow px-2 text-logoblue">
        <div className="truncate text-[1.1rem]">{item.name}</div>
        {item.description && <div className="truncate text-sm font-normal text-textColorThird">{item.description}</div>}
      </div>

      <span className="shrink-0 rounded-full bg-logoblue px-3 py-1 text-xs text-white">
        {statusLabel[item.status][locale === "nb" ? "nb" : "en"]}
      </span>

      <ConditionBadge flags={item} locale={locale} />
    </Link>
  );
}
