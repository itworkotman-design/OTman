"use client";

export type UploadItemStatus = "queued" | "uploading" | "done" | "failed";

export type ContentSaveUploadItem = {
  id: string;
  fileName: string;
  sectionLabel: string;
  status: UploadItemStatus;
  progress: number;
  error?: string;
};

type Props = {
  locale: string;
  items: ContentSaveUploadItem[];
  // True once every item has settled into "done" or "failed" — the modal
  // never auto-closes itself even then, per explicit user request ("it
  // should say Item saved ... and then you can close").
  finished: boolean;
  onClose: () => void;
};

function StatusIcon({ status }: { status: UploadItemStatus }) {
  if (status === "done") return <span className="text-green-600">✓</span>;
  if (status === "failed") return <span className="text-red-600">✕</span>;
  return <span className="text-textColorThird">{status === "uploading" ? "" : "…"}</span>;
}

// Shown while Save is uploading pending files/images to S3 (ContentSectionList's
// Phase 2) — deliberately separate from the quick metadata phase (section
// create/delete, reorder, text-field/spreadsheet flush), which has no
// meaningful "in flight for a while" state worth a modal for. Never
// auto-closes: stays open until the caller marks `finished`, and even then
// requires an explicit Close click, so the user always sees whether anything
// failed. Closing before `finished` is allowed but the caller
// (ContentSectionList) is responsible for warning first and hard-deleting
// whatever did finish uploading — this component only renders state, it
// doesn't own the cancel/rollback decision.
export function ContentSaveUploadModal({ locale, items, finished, onClose }: Props) {
  const failedCount = items.filter((item) => item.status === "failed").length;
  const doneCount = items.filter((item) => item.status === "done").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-textcolor">
          {locale === "nb" ? "Lagrer innhold" : "Saving content"}
        </h2>

        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-lineSecondary px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-textColorSecond">
                    {item.fileName}
                  </span>
                  <StatusIcon status={item.status} />
                </div>
                <p className="mb-1 text-xs text-textColorThird">{item.sectionLabel}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-linePrimary">
                  <div
                    className={`h-full rounded-full transition-all ${item.status === "failed" ? "bg-red-500" : "bg-logoblue"}`}
                    style={{ width: `${item.status === "done" ? 100 : item.progress}%` }}
                  />
                </div>
                {item.status === "failed" && item.error && (
                  <p className="mt-1 text-xs font-medium text-red-600">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-lineSecondary pt-4">
          {finished ? (
            <p className="mb-3 text-sm font-medium text-green-600">
              {failedCount === 0
                ? locale === "nb"
                  ? "Elementet er lagret."
                  : "Item saved."
                : locale === "nb"
                  ? `Lagret, men ${failedCount} fil(er) kunne ikke lastes opp.`
                  : `Saved, but ${failedCount} file(s) failed to upload.`}
            </p>
          ) : (
            <p className="mb-3 text-sm text-textColorThird">
              {locale === "nb"
                ? `Laster opp ${doneCount}/${items.length}...`
                : `Uploading ${doneCount}/${items.length}...`}
            </p>
          )}

          <button type="button" className="customButtonEnabled w-full" onClick={onClose}>
            {locale === "nb" ? "Lukk" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
