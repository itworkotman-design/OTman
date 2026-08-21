import type { ArchiveContentSectionType } from "@prisma/client";
import { ImagesSectionReadOnly } from "@/app/_components/Dahsboard/archive/ImagesSectionReadOnly";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { TextFieldsReadOnly } from "@/app/_components/Dahsboard/archive/TextFieldsReadOnly";
import { SpreadsheetReadOnly } from "@/app/_components/Dahsboard/archive/SpreadsheetReadOnly";
import { TitleReadOnly } from "@/app/_components/Dahsboard/archive/TitleReadOnly";
import { YoutubeEmbedReadOnly } from "@/app/_components/Dahsboard/archive/YoutubeEmbedReadOnly";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";

export type ArchiveContentSectionRow = {
  id: string;
  type: ArchiveContentSectionType;
  position: number;
};

export type ArchiveFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sectionId: string | null;
  description: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

// Read-only rendering of an item's content sections — extracted verbatim
// from ItemView so both it and ShortcutItemView (whose header/breadcrumb
// logic differs — see that file) share the one body that's genuinely
// identical in every entry point.
export function ItemContentSections({
  sections,
  files,
  locale,
}: {
  sections: ArchiveContentSectionRow[];
  files: ArchiveFileRow[];
  locale: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const label = getContentSectionLabel(section.type, locale);
        const sectionFiles = files.filter((f) => f.sectionId === section.id);

        return (
          <div key={section.id}>
            {section.type === "FILES" && (
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-logoblue">
                <ContentSectionTypeIcon type={section.type} className="h-5 w-5 shrink-0" />
                {label.name}
              </h2>
            )}

            {section.type === "TITLE" ? (
              <TitleReadOnly sectionId={section.id} locale={locale} />
            ) : section.type === "TEXT_FIELDS" ? (
              <TextFieldsReadOnly sectionId={section.id} locale={locale} />
            ) : section.type === "SPREADSHEET" ? (
              <SpreadsheetReadOnly sectionId={section.id} locale={locale} />
            ) : section.type === "YOUTUBE" ? (
              <YoutubeEmbedReadOnly sectionId={section.id} locale={locale} />
            ) : section.type === "IMAGES" ? (
              <ImagesSectionReadOnly
                images={sectionFiles.map((f) => ({
                  id: f.id,
                  src: `/api/archive/files/${f.id}/download`,
                  alt: f.originalFileName,
                  description: f.description,
                }))}
                locale={locale}
              />
            ) : sectionFiles.length === 0 ? (
              <div className="flex items-center justify-center rounded-[20px] border border-linePrimary px-5 py-8 text-sm text-textColorThird">
                {locale === "nb" ? "Ingen filer" : "No files"}
              </div>
            ) : (
              <div className="rounded-[20px] pb-5 divide-y divide-lineSecondary">
                {sectionFiles.map((file, fileIndex) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-[2rem_minmax(0,200px)_1fr_auto_auto] items-center gap-4 py-3 px-2 hover:bg-linePrimary"
                  >
                    <span className="text-sm text-textColorThird">{fileIndex + 1}</span>
                    <a
                      href={`/api/archive/files/${file.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-logoblue"
                    >
                      {file.originalFileName}
                    </a>
                    <span className="min-w-0 truncate text-left text-sm text-textColorThird">{file.description}</span>
                    <span className="shrink-0 text-sm text-textColorThird">{formatBytes(file.sizeBytes)}</span>
                    <a
                      href={`/api/archive/files/${file.id}/download?download=1`}
                      download
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-logoblue transition-colors hover:bg-logoblue/10"
                      aria-label={locale === "nb" ? "Last ned" : "Download"}
                      title={locale === "nb" ? "Last ned" : "Download"}
                    >
                      <DownloadIcon />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
