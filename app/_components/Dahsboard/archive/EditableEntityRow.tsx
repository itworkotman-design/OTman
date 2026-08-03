"use client";

import { useState } from "react";
import Link from "next/link";
import { ConditionBadge } from "./ConditionBadge";
import type { ArchiveConditionFlags } from "./types";

type EditableEntityRowProps = {
  name: string;
  description: string | null;
  status: string;
  flags: ArchiveConditionFlags;
  settingsHref: string;
  onArchive: () => void;
  onDelete: () => void;
  archiving?: boolean;
  deleting: boolean;
  locale: string;
};

function DotsIcon() {
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
// deletion at all), Archive/Delete actions are included since the real app
// needs them. Both are tucked behind the 3-dot menu rather than shown as
// standing buttons, so a destructive action isn't one accidental click away.
export function EditableEntityRow({
  name,
  description,
  status,
  flags,
  settingsHref,
  onArchive,
  onDelete,
  archiving = false,
  deleting,
  locale,
}: EditableEntityRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const busy = archiving || deleting;

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

      <div className="relative shrink-0">
        <button
          type="button"
          className="rounded-full p-2 text-logoblue transition-colors hover:bg-logoblue/5"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={locale === "nb" ? `Handlinger for ${name}` : `Actions for ${name}`}
          disabled={busy}
        >
          <DotsIcon />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-lineSecondary bg-white shadow-lg">
              <Link
                href={settingsHref}
                className="block px-4 py-2 text-sm text-logoblue hover:bg-logoblue/5"
                onClick={() => setMenuOpen(false)}
              >
                {locale === "nb" ? "Rediger" : "Edit"}
              </Link>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-logoblue hover:bg-logoblue/5 disabled:opacity-50"
                onClick={() => {
                  setMenuOpen(false);
                  onArchive();
                }}
                disabled={busy}
              >
                {status === "archived"
                  ? locale === "nb"
                    ? "Gjenåpne"
                    : "Unarchive"
                  : locale === "nb"
                    ? "Arkiver"
                    : "Archive"}
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                disabled={busy}
              >
                {locale === "nb" ? "Slett" : "Delete"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
