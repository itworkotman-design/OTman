// app/_components/blog/ImageCarousel.tsx
"use client";

import { useEffect, useState } from "react";

export type CarouselImage = {
  src: string;
  alt: string;
  caption?: string;
};

type Props = {
  images: CarouselImage[];
  autoplay?: boolean;
  intervalSeconds?: number;
  frameClassName?: string;
};

export function ImageCarousel({
  images,
  autoplay = false,
  intervalSeconds = 5,
  frameClassName = "aspect-video rounded-md bg-linePrimary/20",
}: Props) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  useEffect(() => {
    if (!autoplay || total <= 1) return;
    const intervalMs = intervalSeconds * 1000;
    const timer = setInterval(() => setIndex((i) => (i + 1) % total), intervalMs);
    return () => clearInterval(timer);
  }, [autoplay, intervalSeconds, total]);

  if (total === 0) return null;

  const current = images[Math.min(index, total - 1)];

  return (
    <div>
      <div className={`relative overflow-hidden ${frameClassName}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.alt} className="h-full w-full object-cover" />

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-lg text-textcolor shadow"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => setIndex((i) => (i + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-lg text-textcolor shadow"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {current.caption ? (
        <p className="mt-2 text-center text-sm text-textColorSecond">{current.caption}</p>
      ) : null}

      {total > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${i === index ? "bg-logoblue" : "bg-linePrimary"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
