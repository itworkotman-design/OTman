// path: app/_components/Dahsboard/booking/create/OrderAttachmentsSection.tsx
"use client";

import { useId } from "react";

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

type Props = {
  attachments: AttachmentItem[];
  uploading: boolean;
  error: string;
  canDelete?: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onDelete?: (attachmentId: string) => void | Promise<void>;
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
}: Props) {
  const inputId = useId();

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        Attachments
      </label>

      <div className="mb-3">
        <input
          id={inputId}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
            e.currentTarget.value = "";
          }}
        />

        <label
          htmlFor={inputId}
          className="customButtonDefault inline-flex w-30 cursor-pointer items-center justify-center"
        >
          Choose file
        </label>

        {uploading && <span className="text-sm">Uploading...</span>}
      </div>

      {error ? <div className="mb-2 text-sm text-red-600">{error}</div> : null}

      {attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="relative overflow-hidden rounded border bg-white"
            >
              {isImage(file) ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="h-24 w-full object-cover hover:opacity-80"
                  />
                </a>
              ) : isPdf(file) ? (
                <div className="flex h-24 w-full items-center justify-center bg-gray-100 px-2 text-center text-sm font-medium text-logoblue">
                  PDF
                </div>
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-gray-100 px-2 text-center text-sm font-medium text-textColorThird">
                  File
                </div>
              )}

              <div className="px-2 py-2">
                <div className="truncate text-xs font-medium">
                  {file.filename}
                </div>
                <div className="text-[11px] text-textColorThird">
                  {(file.sizeBytes / 1024).toFixed(1)} KB
                </div>

                <div className="mt-2 flex gap-3 text-[11px]">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-logoblue underline"
                  >
                    Open
                  </a>

                  <a
                    href={file.url}
                    download={file.filename}
                    className="text-textColorThird underline"
                  >
                    Download
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
          ))}
        </div>
      ) : (
        <div className="text-sm text-textColorThird">No attachments yet.</div>
      )}
    </div>
  );
}
