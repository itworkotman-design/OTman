"use client";

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

export default function OrderAttachmentsSection({
  attachments,
  uploading,
  error,
  canDelete = true,
  onUpload,
  onDelete,
}: Props) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        Attachments
      </label>

      <div className="mb-3 flex items-center gap-2 customButtonDefault w-30">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
            e.currentTarget.value = "";
          }}
        />

        {uploading && <span className="text-sm">Uploading...</span>}
      </div>

      {error ? <div className="mb-2 text-sm text-red-600">{error}</div> : null}

      {attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="relative overflow-hidden rounded border"
            >
              <img
                src={file.url}
                alt={file.filename}
                className="h-24 w-full object-cover"
              />

              <div className="px-2 py-1">
                <div className="truncate text-xs">{file.filename}</div>
                <div className="text-[11px] text-textColorThird">
                  {(file.sizeBytes / 1024).toFixed(1)} KB
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
