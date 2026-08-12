"use client";

import { useReducer, type ReactNode } from "react";

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

type PreviewState = { activeIndex: number | null };

type PreviewAction =
  | { type: "open"; index: number }
  | { type: "close" }
  | { type: "next"; imageCount: number }
  | { type: "previous"; imageCount: number };

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

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === "open") return { activeIndex: action.index };
  if (action.type === "close") return { activeIndex: null };
  if (state.activeIndex === null || action.imageCount === 0) return state;
  if (action.type === "next") return { activeIndex: (state.activeIndex + 1) % action.imageCount };
  return { activeIndex: (state.activeIndex - 1 + action.imageCount) % action.imageCount };
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
  const [state, dispatch] = useReducer(previewReducer, { activeIndex: null });
  const activeImage = state.activeIndex === null ? null : images[state.activeIndex];

  return (
    <>
      <div
        className={
          uniformHeight
            ? `flex flex-wrap items-start ${gap ? "gap-3" : "gap-0"}`
            : `grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] ${gap ? "gap-3" : "gap-0"}`
        }
      >
        {leading}
        {images.map((image, index) => (
          <div key={image.id} className="group relative">
            <button
              type="button"
              onClick={() => dispatch({ type: "open", index })}
              className={`rounded-xl border border-lineSecondary p-3 text-left transition-colors hover:border-logoblue ${uniformHeight ? "pb-14" : "w-full"}`}
            >
              {uniformHeight ? (
                <div className="relative mx-auto inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} className="h-64 w-auto object-contain" />
                  {/* Pinned to this wrapper's own (image-derived) width via
                      absolute positioning, so long captions truncate instead
                      of stretching the tile wider than the image. */}
                  <div className="absolute inset-x-0 top-full mt-2">
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
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-logoblue opacity-0 shadow transition-opacity hover:bg-logoblue/10 group-hover:opacity-100"
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

      {activeImage && state.activeIndex !== null ? (
        <div className="fixed inset-0 z-50 grid bg-black/70 p-6" onClick={() => dispatch({ type: "close" })}>
          <div
            className="relative m-auto grid max-h-full w-full max-w-5xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-3xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-lineSecondary px-5 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-logoblue">{activeImage.alt}</div>
                {activeImage.description ? (
                  <div className="truncate text-sm text-textColorThird">{activeImage.description}</div>
                ) : null}
              </div>
              <button type="button" onClick={() => dispatch({ type: "close" })} className="shrink-0 text-sm font-semibold text-textColorThird hover:text-logoblue">
                Close
              </button>
            </div>

            <div className={`grid items-center gap-4 p-5 ${images.length > 1 ? "grid-cols-[auto_1fr_auto]" : "grid-cols-1"}`}>
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "previous", imageCount: images.length })}
                  className="h-12 w-12 rounded-full border border-lineSecondary text-2xl font-semibold text-logoblue hover:bg-logoblue hover:text-white"
                  aria-label="Previous image"
                >
                  &lt;
                </button>
              )}
              <div className="relative flex min-h-[420px] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeImage.src} alt={activeImage.alt} className="max-h-[65vh] w-auto max-w-full object-contain" />
                {downloadable && (
                  <a
                    href={`${activeImage.src}?download=1`}
                    download
                    className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white text-logoblue shadow transition-colors hover:bg-logoblue/10"
                    aria-label="Download image"
                    title="Download"
                  >
                    <DownloadIcon />
                  </a>
                )}
              </div>
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "next", imageCount: images.length })}
                  className="h-12 w-12 rounded-full border border-lineSecondary text-2xl font-semibold text-logoblue hover:bg-logoblue hover:text-white"
                  aria-label="Next image"
                >
                  &gt;
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-lineSecondary p-3">
              {images.map((image, index) => (
                <button
                  key={`preview-${image.id}`}
                  type="button"
                  onClick={() => dispatch({ type: "open", index })}
                  className={`h-16 w-20 shrink-0 rounded-lg border p-1 ${index === state.activeIndex ? "border-logoblue" : "border-lineSecondary"}`}
                  aria-label={`Preview ${image.alt}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
