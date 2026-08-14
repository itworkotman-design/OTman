"use client";

import { useState, type ReactNode } from "react";
import { ImageLightbox } from "@/app/_components/utils/ImageLightbox";

export type PreviewableImage = {
  id: string;
  src: string;
  alt: string;
  description?: string | null;
};

type ImagePreviewGridProps = {
  images: PreviewableImage[];
  // Rendered as the grid's first cell (see ContentSectionCard's
  // AddImageTile) — kept separate from `trailing` so it has a fixed
  // position and doesn't shift around as images/pending uploads come and go.
  leading?: ReactNode;
  // Rendered as one more cell in the same auto-fit grid as the images
  // themselves — e.g. pending (not-yet-uploaded) image tiles.
  trailing?: ReactNode;
  // Settings views only allow deleting an image (onDeleteImage); read-only
  // views only allow downloading it. Never both.
  downloadable?: boolean;
  onDeleteImage?: (id: string) => void;
  // Only passed from the settings context — its presence is what switches an
  // image's caption from a plain read-only line (or nothing, if there's no
  // description) to an editable input. Read-only views never pass this.
  onDescriptionChange?: (id: string, description: string) => void;
  // Settings context keeps the gap (leading "Add image"/trailing pending
  // tiles need visual separation); read-only views can turn it off.
  gap?: boolean;
  // Settings context needs equal-width grid cells (leading/trailing tiles
  // line up predictably); read-only views can switch to a flex row of
  // fixed-height, natural-width thumbnails instead.
  uniformHeight?: boolean;
};

// Editable caption for one image — fully controlled by the settings-context
// caller (ContentSectionList stages the edit and only PATCHes it at Save
// time, same deferred model as everything else there), same as
// ContentSectionCard's FileDescriptionInput for non-image files. Kept
// outside the preview-open <button> (not nested inside it) so clicking or
// typing into the input doesn't also trigger the button's click handler.
function ImageDescriptionInput({
  description,
  onChange,
}: {
  description: string | null | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={description ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Add a description..."
      className="customInput mt-2 w-full !py-1 text-xs"
    />
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
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

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ExpandIcon() {
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
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

// Ported from the otman-archive prototype's ImagePreviewGrid, adapted to
// plain <img> (real files are downloaded via an authenticated API route, not
// static/optimizable assets, so next/image's optimizer doesn't apply here).
//
// `auto-fit`/`minmax` instead of a fixed column count: with 1 image the
// single column stretches to fill the row (as big as a lone "full-width"
// image would be), 2 images split the row in half, 3 in thirds, and once
// there's no more room images wrap onto further rows — no separate
// per-section layout choice needed for that. Each image is capped at 400px
// tall so a single large image doesn't blow out the section's height.
export function ImagePreviewGrid({
  images,
  leading,
  trailing,
  downloadable = true,
  onDeleteImage,
  onDescriptionChange,
  gap = true,
  uniformHeight = false,
}: ImagePreviewGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex];

  return (
    <>
      <div
        className={
          uniformHeight
            ? `relative flex flex-wrap items-start ${gap ? "gap-3" : "gap-0"}`
            : `grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] ${gap ? "gap-3" : "gap-0"}`
        }
      >
        {/* One "opens a viewer" hint for the whole section rather than one
            per thumbnail — tapping any individual image still opens the
            lightbox at that image, this is purely a mobile-only visual cue. */}
        {uniformHeight && images.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-1 flex items-center justify-center bg-black/30 sm:hidden">
            <span className="rounded-full bg-black/50 p-2 text-white">
              <ExpandIcon />
            </span>
          </div>
        )}
        {leading}
        {images.map((image, index) => (
          <div key={image.id} className="group relative">
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`rounded-xl text-left transition-colors ${
                uniformHeight
                  ? "p-0 sm:border sm:border-lineSecondary sm:p-3 sm:pb-14 sm:hover:border-logoblue"
                  : "w-full border border-lineSecondary p-3 hover:border-logoblue"
              }`}
            >
              {uniformHeight ? (
                // Small on phone, flush against its neighbors (no padding/
                // border) — this is just a tap target to open the full
                // ImagePreviewGrid lightbox below, not a place to actually
                // look at the image, so the caption stays hidden and a dim
                // overlay + expand icon signals "opens a viewer" until sm:,
                // where it reverts to a normal bordered/captioned tile.
                <div className="relative mx-auto inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} className="h-16 w-auto object-contain sm:h-64" />
                  {/* Pinned to this wrapper's own (image-derived) width via
                      absolute positioning, so long captions truncate instead
                      of stretching the tile wider than the image. */}
                  <div className="absolute inset-x-0 top-full mt-2 hidden sm:block">
                    <p className="truncate text-center text-sm text-textColorSecond">{image.alt}</p>
                    {!onDescriptionChange && image.description ? (
                      <p className="mt-1 line-clamp-2 text-center text-xs text-textColorThird">{image.description}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} className="mx-auto max-h-100 w-full object-contain" />
                  <p className="mt-2 truncate text-center text-sm text-textColorSecond">{image.alt}</p>
                  {!onDescriptionChange && image.description ? (
                    <p className="mt-1 line-clamp-2 text-center text-xs text-textColorThird">{image.description}</p>
                  ) : null}
                </>
              )}
            </button>
            {onDescriptionChange ? (
              <ImageDescriptionInput
                description={image.description}
                onChange={(value) => onDescriptionChange(image.id, value)}
              />
            ) : null}
            {onDeleteImage ? (
              <button
                type="button"
                onClick={() => onDeleteImage(image.id)}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-600 shadow transition-colors hover:bg-red-50"
                aria-label="Delete image"
                title="Delete"
              >
                <DeleteIcon />
              </button>
            ) : downloadable ? (
              <a
                href={`${image.src}?download=1`}
                download
                // `opacity-0`/hover-reveal only makes sense with an actual
                // hover state — on touch there's no hover to gate it behind,
                // so this stayed invisible but still tappable, quietly
                // eating taps meant for the (much smaller, on phone) image
                // button underneath. Hidden outright below sm:.
                className="absolute right-2 top-2 hidden h-8 w-8 place-items-center rounded-full bg-white text-logoblue opacity-0 shadow transition-opacity hover:bg-logoblue/10 group-hover:opacity-100 sm:grid"
                aria-label="Download image"
                title="Download"
              >
                <DownloadIcon />
              </a>
            ) : null}
          </div>
        ))}
        {trailing}
      </div>

      {activeImage && activeIndex !== null ? (
        <ImageLightbox
          images={images.map((image) => ({ src: image.src, alt: image.alt, caption: image.description }))}
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          background="white"
          showTitle
          downloadable={downloadable}
        />
      ) : null}
    </>
  );
}
