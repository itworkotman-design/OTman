// app/_components/Dahsboard/website/BlogImagePicker.tsx
"use client";

import { useRef } from "react";
import { useBlogImageUpload } from "@/lib/blog/useBlogImageUpload";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";

type Props = {
  storagePath: string | null;
  onChange: (storagePath: string | null) => void;
  // Vertical focal point, 0 (top) - 100 (bottom) — same 0-100 scale the
  // image is rendered with everywhere via `object-position: center Y%`, so
  // dragging this preview's slider previews the exact crop every other
  // rendered size (card, related-posts thumbnail, etc.) will use. Only the
  // blog post's single cover image has a reposition slider — gallery/
  // carousel/image-section pictures render at their natural aspect ratio,
  // so this pair is optional and the slider only shows up when passed.
  position?: number;
  onPositionChange?: (position: number) => void;
  blogPostId: string;
  label?: string;
};

export default function BlogImagePicker({ storagePath, onChange, position, onPositionChange, blogPostId, label }: Props) {
  const { upload, isUploading, error } = useBlogImageUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = getPublicBlogImageUrl(storagePath);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload(file, blogPostId);
    if (result) onChange(result.storagePath);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold text-textcolor">{label}</span> : null}
      {previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-32 w-full max-w-xs rounded-md object-cover"
            style={{ objectPosition: `center ${position ?? 50}%` }}
          />
          {onPositionChange ? (
            <label className="flex w-full max-w-xs flex-col gap-1 text-xs text-textColorSecond">
              Vertical position
              <input
                type="range"
                min={0}
                max={100}
                value={position ?? 50}
                onChange={(e) => onPositionChange(Number(e.target.value))}
              />
            </label>
          ) : null}
        </>
      ) : (
        <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-linePrimary text-xs text-textColorSecond">
          No image
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="text-sm"
        />
        {storagePath ? (
          <button type="button" className="customButtonDefault" onClick={() => onChange(null)}>
            Remove
          </button>
        ) : null}
      </div>
      {isUploading ? <span className="text-xs text-textColorSecond">Uploading...</span> : null}
      {error ? <span className="text-xs text-red-600">Upload failed</span> : null}
    </div>
  );
}
