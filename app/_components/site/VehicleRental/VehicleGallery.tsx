"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

interface VehicleGalleryProps {
  images: string[];
  name: string;
  extraImages?: string[];
  extraImagesLabel?: string;
}

interface NavButtonProps {
  direction: "prev" | "next";
  onPrev: () => void;
  onNext: () => void;
}

function NavButton({ direction, onPrev, onNext }: NavButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (direction === "prev") { onPrev(); } else { onNext(); }
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

function ImageLightbox({
  images,
  name,
  onClose,
}: {
  images: string[];
  name: string;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const THUMB_COUNT = 7;
  const half = Math.floor(THUMB_COUNT / 2);
  const thumbStart = Math.max(0, Math.min(activeIndex - half, images.length - THUMB_COUNT));
  const thumbEnd = Math.min(images.length, thumbStart + THUMB_COUNT);
  const visibleThumbIndices = Array.from({ length: thumbEnd - thumbStart }, (_, i) => thumbStart + i);

  const prev = useCallback(
    () => setActiveIndex((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setActiveIndex((i) => (i + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); }
      else if (e.key === "ArrowLeft") { prev(); }
      else if (e.key === "ArrowRight") { next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        className="relative w-full max-w-5xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-[70vh]">
          <Image
            src={images[activeIndex]}
            fill
            alt={`${name} - image ${activeIndex + 1}`}
            className="object-contain"
            sizes="(min-width: 1024px) 1024px, 100vw"
            priority
          />
        </div>
        {images.length > 1 && (
          <>
            <NavButton direction="prev" onPrev={prev} onNext={next} />
            <NavButton direction="next" onPrev={prev} onNext={next} />
          </>
        )}
      </div>

      {images.length > 1 && (
        <div
          className="flex gap-3 mt-4 pb-1 px-4 justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {visibleThumbIndices.map((i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`relative shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIndex ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <Image src={images[i]} fill alt={`${name} ${i + 1}`} className="object-cover" sizes="96px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VehicleGallery({ images, name, extraImages, extraImagesLabel }: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [extraModalOpen, setExtraModalOpen] = useState(false);

  const THUMB_COUNT = 7;
  const half = Math.floor(THUMB_COUNT / 2);
  const thumbStart = Math.max(0, Math.min(activeIndex - half, images.length - THUMB_COUNT));
  const thumbEnd = Math.min(images.length, thumbStart + THUMB_COUNT);
  const visibleThumbIndices = Array.from({ length: thumbEnd - thumbStart }, (_, i) => thumbStart + i);

  const prev = useCallback(
    () => setActiveIndex((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setActiveIndex((i) => (i + 1) % images.length),
    [images.length]
  );
  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeModal(); }
      else if (e.key === "ArrowLeft") { prev(); }
      else if (e.key === "ArrowRight") { next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal, prev, next]);

  const hasExtra = extraImages && extraImages.length > 0;

  return (
    <>
      <div className="w-full">
        <div
          className="relative w-full h-[800] rounded-2xl overflow-hidden cursor-zoom-in"
          onClick={() => setModalOpen(true)}
        >
          <Image
            src={images[activeIndex]}
            fill
            alt={`${name} - image ${activeIndex + 1}`}
            className="object-contain scale-100"
            sizes="(min-width: 1280px) 1200px, 100vw"
            priority
          />
          {images.length > 1 && (
            <>
              <NavButton direction="prev" onPrev={prev} onNext={next} />
              <NavButton direction="next" onPrev={prev} onNext={next} />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                    aria-label={`Go to image ${i + 1}`}
                    className={`w-2 h-2 rounded-full transition-all ${i === activeIndex ? "bg-white scale-125" : "bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          {images.length > 1 && (
            <div className="flex gap-3 pb-1 justify-center flex-1">
              {visibleThumbIndices.map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`relative shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    i === activeIndex ? "border-logoblue opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  <Image src={images[i]} fill alt={`${name} ${i + 1}`} className="object-cover" sizes="96px" />
                </button>
              ))}
            </div>
          )}

          {hasExtra && (
            <button
              onClick={() => setExtraModalOpen(true)}
              className="shrink-0 ml-4 flex items-center gap-2 px-4 py-2 rounded-xl border border-lineSecondary text-textcolor hover:text-logoblue hover:border-logoblue transition text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              {extraImagesLabel ?? "Extra images"} ({extraImages!.length})
            </button>
          )}
        </div>
      </div>

      {modalOpen && (
        <ImageLightbox images={images} name={name} onClose={closeModal} />
      )}

      {extraModalOpen && hasExtra && (
        <ImageLightbox images={extraImages!} name={name} onClose={() => setExtraModalOpen(false)} />
      )}
    </>
  );
}
