"use client";

import type { ArchiveContentSectionType } from "@prisma/client";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";

const SECTION_TYPES: ArchiveContentSectionType[] = ["TITLE", "IMAGES", "FILES", "TEXT_FIELDS", "SPREADSHEET"];

type Props = {
  locale: string;
  onPick: (type: ArchiveContentSectionType) => void;
  onClose: () => void;
};

// An item can hold any number of sections of the same type (e.g. two
// separate Images galleries), so every type is always offered here — not
// filtered down to "types not already present".
export function ContentSectionPicker({ locale, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-textcolor">{locale === "nb" ? "Legg til seksjon" : "Add section"}</h2>
          <button type="button" className="customButtonDefault" onClick={onClose}>
            {locale === "nb" ? "Lukk" : "Close"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SECTION_TYPES.map((type) => {
            const label = getContentSectionLabel(type, locale);
            return (
              <button
                key={type}
                type="button"
                className="flex flex-col items-start rounded-md border border-linePrimary p-4 text-left hover:bg-linePrimary/40"
                onClick={() => {
                  onPick(type);
                  onClose();
                }}
              >
                <ContentSectionTypeIcon type={type} className="h-6 w-6 text-logoblue" />
                <span className="mt-2 font-semibold text-textcolor">{label.name}</span>
                <span className="mt-1 text-sm text-textColorSecond">{label.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
