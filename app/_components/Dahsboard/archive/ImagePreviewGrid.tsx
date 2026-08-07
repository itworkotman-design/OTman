"use client";

import { useReducer } from "react";

export type PreviewableImage = {
  id: string;
  src: string;
  alt: string;
};

type ImagePreviewGridProps = {
  images: PreviewableImage[];
  columns?: 2 | 5;
};

type PreviewState = { activeIndex: number | null };

type PreviewAction =
  | { type: "open"; index: number }
  | { type: "close" }
  | { type: "next"; imageCount: number }
  | { type: "previous"; imageCount: number };

const gridColumnClasses: Record<NonNullable<ImagePreviewGridProps["columns"]>, string> = {
  2: "grid-cols-2",
  5: "grid-cols-5",
};

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
export function ImagePreviewGrid({ images, columns = 5 }: ImagePreviewGridProps) {
  const [state, dispatch] = useReducer(previewReducer, { activeIndex: null });
  const activeImage = state.activeIndex === null ? null : images[state.activeIndex];

  return (
    <>
      <div className={`grid ${gridColumnClasses[columns]} gap-3`}>
        {images.map((image, index) => (
          <div key={image.id} className="relative">
            <button
              type="button"
              onClick={() => dispatch({ type: "open", index })}
              className="w-full rounded-xl border border-lineSecondary p-3 text-left transition-colors hover:border-logoblue"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.alt} className="mx-auto h-24 w-full object-contain" />
              <p className="mt-2 truncate text-center text-sm text-textColorSecond">{image.alt}</p>
            </button>
            <a
              href={`${image.src}?download=1`}
              download
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-logoblue shadow transition-colors hover:bg-logoblue/10"
              aria-label="Download image"
              title="Download"
            >
              <DownloadIcon />
            </a>
          </div>
        ))}
      </div>

      {activeImage && state.activeIndex !== null ? (
        <div className="fixed inset-0 z-50 grid bg-black/70 p-6" onClick={() => dispatch({ type: "close" })}>
          <div
            className="relative m-auto grid max-h-full w-full max-w-5xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-3xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-lineSecondary px-5 py-3">
              <div className="min-w-0 truncate font-semibold text-logoblue">{activeImage.alt}</div>
              <button type="button" onClick={() => dispatch({ type: "close" })} className="text-sm font-semibold text-textColorThird hover:text-logoblue">
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
                <a
                  href={`${activeImage.src}?download=1`}
                  download
                  className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white text-logoblue shadow transition-colors hover:bg-logoblue/10"
                  aria-label="Download image"
                  title="Download"
                >
                  <DownloadIcon />
                </a>
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
