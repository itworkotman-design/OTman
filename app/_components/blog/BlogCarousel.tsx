// app/_components/blog/BlogCarousel.tsx
"use client";

import { useEffect, useState } from "react";
import type { CarouselSectionData } from "@/lib/blog/blogSectionSchemas";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import type { Locale } from "@/lib/content/NavbarContent";

type Props = {
  section: CarouselSectionData;
  locale: Locale;
};

export default function BlogCarousel({ section, locale }: Props) {
  const [index, setIndex] = useState(0);
  const total = section.images.length;

  useEffect(() => {
    if (!section.autoplay || total <= 1) return;
    const intervalMs = (section.intervalSeconds ?? 5) * 1000;
    const timer = setInterval(() => setIndex((i) => (i + 1) % total), intervalMs);
    return () => clearInterval(timer);
  }, [section.autoplay, section.intervalSeconds, total]);

  if (total === 0) return null;

  const current = section.images[Math.min(index, total - 1)];
  const url = getPublicBlogImageUrl(current.storagePath);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-md bg-linePrimary/20">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={getLocalizedText(current.alt, locale)} className="h-full w-full object-cover" />
        ) : null}

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

      {getLocalizedText(current.caption, locale) ? (
        <p className="mt-2 text-center text-sm text-textColorSecond">{getLocalizedText(current.caption, locale)}</p>
      ) : null}

      {total > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {section.images.map((_, i) => (
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
