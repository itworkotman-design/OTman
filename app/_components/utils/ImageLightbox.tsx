"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LightboxImage = {
  src: string;
  alt: string;
  caption?: string | null;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  // Matches the public site's vehicle gallery by default — dark backdrop,
  // image floats directly on it, no title/download chrome. The archive
  // read-only image viewer opts into a white background behind the image
  // plus a title and download button via these three params, instead of
  // keeping its own near-duplicate modal implementation.
  background?: "black" | "white";
  // Shows the *current* image's own alt/caption at the top, updating as you
  // navigate — not a fixed label — matching what archive's old built-in
  // modal always did.
  showTitle?: boolean;
  downloadable?: boolean;
};

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function NavButton({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
      className="absolute top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition"
      style={{ [direction === "prev" ? "left" : "right"]: "0.75rem" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
        <path strokeLinecap="round" strokeLinejoin="round" d={direction === "prev" ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} />
      </svg>
    </button>
  );
}

// Shared full-screen image viewer — originally the public site's vehicle
// gallery had its own, and the dashboard archive's read-only image section
// had another that laid prev/next out as their own grid columns instead of
// floating over the image, squeezing it narrower on anything but a wide
// screen. Nav arrows always float over the image here, never take up their
// own layout space, so the image itself is always full width.
export function ImageLightbox({ images, initialIndex = 0, onClose, background = "black", showTitle = false, downloadable = false }: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeImage = images[activeIndex];
  const isWhite = background === "white";
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setActiveIndex((i) => (i + 1) % images.length), [images.length]);

  // Keeps the active thumbnail centered in the strip regardless of how it
  // became active — clicking a thumbnail directly, or paging with the
  // prev/next arrows. The strip itself stays freely scrollable/draggable on
  // top of this (scrollIntoView doesn't fight a manual drag mid-gesture).
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // `overflow: hidden` on body alone doesn't stop touch scrolling on iOS
  // Safari — it still lets the page pan underneath a `position: fixed`
  // overlay. Pinning the body itself to `position: fixed` at its current
  // scroll offset is the reliable cross-browser way to actually freeze it;
  // the scroll position is restored on close.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (!activeImage) return null;

  // "white" isn't just a white box behind the image — the whole modal
  // surface (backdrop, thumbnail strip included) is white, so every other
  // bit of chrome that was designed to sit on a dark backdrop (close/
  // download buttons, the active-thumbnail border) needs a light-surface
  // counterpart too, or it'd be invisible against it.
  const chromeButtonClass = isWhite ? "bg-black/5 text-textcolor hover:bg-black/10" : "bg-white/20 text-white hover:bg-white/40";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-4 sm:px-6 ${isWhite ? "bg-white" : "bg-black/90"}`}
      onClick={onClose}
    >
      <button onClick={onClose} aria-label="Close" className={`absolute top-4 right-4 rounded-full p-2 transition ${chromeButtonClass}`}>
        <CloseIcon />
      </button>

      {downloadable && (
        <a
          href={`${activeImage.src}?download=1`}
          download
          onClick={(e) => e.stopPropagation()}
          aria-label="Download image"
          title="Download"
          className={`absolute top-4 right-16 rounded-full p-2 transition ${chromeButtonClass}`}
        >
          <DownloadIcon />
        </a>
      )}

      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {showTitle && (
          <div className={`mb-2 truncate font-semibold ${isWhite ? "text-logoblue" : "rounded-xl bg-white px-4 py-2 text-logoblue"}`}>
            {activeImage.alt}
            {activeImage.caption ? <span className="ml-2 truncate font-normal text-textColorThird">— {activeImage.caption}</span> : null}
          </div>
        )}

        <div className="relative h-[70dvh] w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage.src} alt={activeImage.alt} className="h-full w-full object-contain" />
          {images.length > 1 && (
            <>
              <NavButton direction="prev" onClick={prev} />
              <NavButton direction="next" onClick={next} />
            </>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex w-full max-w-full justify-center gap-3 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
          {images.map((image, i) => (
            <button
              key={i}
              ref={i === activeIndex ? activeThumbRef : undefined}
              onClick={() => setActiveIndex(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                i === activeIndex
                  ? isWhite
                    ? "border-logoblue opacity-100"
                    : "border-white opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
