"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

interface VehicleGalleryProps {
  images: string[];
  name: string;
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

export default function VehicleGallery({ images, name }: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

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
            className="object-contain scale-100 transition-opacity duration-300"
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

        {images.length > 1 && (
          <div className="flex gap-3 mt-4 pb-1 justify-center">
            {visibleThumbIndices.map((i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`relative shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  i === activeIndex ? "border-logoblue opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                }`}
              >
                <Image src={images[i]} fill alt={`${name} ${i + 1}`} className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
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
                  <Image src={images[i]} fill alt={`${name} ${i + 1}`} className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
