// path: app/_components/Dahsboard/booking/create/OrderAttachmentsSection.tsx
"use client";

import { useId } from "react";
import {
  ATTACHMENT_CATEGORIES,
  type AttachmentCategory,
  type AttachmentItem,
} from "@/lib/orders/attachmentCategories";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  attachments: AttachmentItem[];
  uploading: boolean;
  error: string;
  canDelete?: boolean;
  onUpload: (
    file: File,
    category: AttachmentCategory,
  ) => void | Promise<void>;
  onDelete?: (attachmentId: string) => void | Promise<void>;
  locale?: BookingUiLocale;
};

function isImage(file: AttachmentItem) {
  return file.mimeType.startsWith("image/");
}

function isPdf(file: AttachmentItem) {
  return file.mimeType === "application/pdf";
}

export default function OrderAttachmentsSection({
  attachments,
  uploading,
  error,
  canDelete = true,
  onUpload,
  onDelete,
  locale = "en",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const inputId = useId();

  return (
    <div>
      {ATTACHMENT_CATEGORIES.map((category) => {
        const files = attachments.filter((file) => file.category === category);
        const categoryId = `${inputId}-${category.toLowerCase()}`;
        const emptyLabel =
          category === "RECEIPT" ? t("No receipts yet.") : t("No attachments yet.");
        const buttonLabel =
          category === "RECEIPT" ? t("Please add receipt!") : t("Choose attachment");
        const categoryLabel =
          category === "RECEIPT" ? t("Receipts") : t("Attachments");

        return (
          <div key={category} className="mb-4 last:mb-0">
            <div className="mb-2 inline">
              <input
                id={categoryId}
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file, category);
                  e.currentTarget.value = "";
                }}
              />

              <label htmlFor={categoryId} className="customButtonDefault inline-flex min-w-34 cursor-pointer items-center justify-center">
                {categoryLabel}
              </label>
            </div>

            <div className={`mb-2 text-sm font-medium inline pl-5 ${category === "RECEIPT" ? "text-red-600" : "text-neutral-700"}`}>{buttonLabel}</div>

            {files.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 mt-4">
                {files.map((file) => {
                  const downloadUrl = file.downloadUrl ?? file.url;

                  return (
                    <div key={file.id} className="relative overflow-hidden rounded border bg-white">
                      {isImage(file) ? (
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <img src={file.url} alt={file.filename} className="h-24 w-full object-cover hover:opacity-80" />
                        </a>
                      ) : isPdf(file) ? (
                        <div className="flex h-24 w-full items-center justify-center bg-gray-100 px-2 text-center text-sm font-medium text-logoblue">PDF</div>
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center bg-gray-100 px-2 text-center text-sm font-medium text-textColorThird">
                          File
                        </div>
                      )}

                      <div className="px-2 py-2">
                        <div className="truncate text-xs font-medium">{file.filename}</div>
                        <div className="text-[11px] text-textColorThird">{(file.sizeBytes / 1024).toFixed(1)} KB</div>

                        <div className="mt-2 flex gap-3 text-[11px]">
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-logoblue underline">
                            {t("Open")}
                          </a>

                          <a href={downloadUrl} download={file.filename} className="text-textColorThird underline">
                            {t("Download")}
                          </a>
                        </div>
                      </div>

                      {canDelete && onDelete ? (
                        <button
                          type="button"
                          onClick={() => void onDelete(file.id)}
                          className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs text-white"
                        >
                          X
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              ""
            )}
          </div>
        );
      })}

      {uploading && <div className="mb-3 text-sm">{t("Uploading...")}</div>}

      {error ? <div className="mb-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
