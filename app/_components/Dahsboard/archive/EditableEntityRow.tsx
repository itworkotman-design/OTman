import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import type { ArchiveConditionFlags } from "./types";

type EditableEntityRowProps = {
  name: string;
  description: string | null;
  status: string;
  flags: ArchiveConditionFlags;
  settingsHref: string;
  onDelete: () => void;
  deleting: boolean;
  locale: string;
};

function EditDotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

// Ported from the otman-archive prototype's EditableSectionItem — a row used
// on folder-settings pages for both subfolders and items, linking onward to
// that entity's own settings page. Unlike the prototype (which models no
// deletion at all), a Delete button is included since the real app needs one
// and this settings-page row is the one place list management happens.
export function EditableEntityRow({
  name,
  description,
  status,
  flags,
  settingsHref,
  onDelete,
  deleting,
  locale,
}: EditableEntityRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-lineSecondary px-4 py-3">
      <div className="min-w-0 grow">
        <div className="flex items-center gap-2 font-semibold text-logoblue">
          {name}
          <ConditionBadge flags={flags} locale={locale} />
        </div>
        {description && <div className="truncate text-sm text-textColorSecond">{description}</div>}
      </div>
      <div className="shrink-0 text-sm text-textColorThird">{status}</div>
      <Link
        href={settingsHref}
        className="rounded-full p-2 text-logoblue transition-colors hover:bg-logoblue/5"
        aria-label={locale === "nb" ? `Innstillinger for ${name}` : `Settings for ${name}`}
      >
        <EditDotsIcon />
      </Link>
      <button
        type="button"
        className="customButtonDefault shrink-0"
        onClick={onDelete}
        disabled={deleting}
      >
        {locale === "nb" ? "Slett" : "Delete"}
      </button>
    </div>
  );
}
