// app/_components/blog/RelatedBlogPosts.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import type { PublicBlogPostSummary } from "@/lib/blog/publicBlogQueries";
import type { Locale } from "@/lib/content/NavbarContent";

const TEXT = {
  heading: { en: "More from the blog", no: "Mer fra bloggen" },
  previous: { en: "Previous", no: "Forrige" },
  next: { en: "Next", no: "Neste" },
};

// "Slowly turning" — long enough between advances to read a card, short
// enough that the carousel visibly moves within a normal time-on-page.
const AUTOPLAY_INTERVAL_MS = 5000;

type Props = {
  posts: PublicBlogPostSummary[];
  locale: Locale;
};

export default function RelatedBlogPosts({ posts, locale }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || posts.length <= 1) return;

    const timer = setInterval(() => {
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
      if (atEnd) {
        scroller.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroller.scrollBy({ left: scroller.clientWidth / 3, behavior: "smooth" });
      }
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [posts.length]);

  function scrollByOneCard(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: (direction * scrollerRef.current.clientWidth) / 3, behavior: "smooth" });
  }

  if (posts.length === 0) return null;

  return (
    <div className="mt-16 border-t border-linePrimary pt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-textcolor">{TEXT.heading[locale]}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={TEXT.previous[locale]}
            onClick={() => scrollByOneCard(-1)}
            className="customButtonDefault !px-2 !py-1"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={TEXT.next[locale]}
            onClick={() => scrollByOneCard(1)}
            className="customButtonDefault !px-2 !py-1"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => {
          const imageUrl = getPublicBlogImageUrl(post.coverImagePath);
          return (
            <Link
              key={post.id}
              href={`/${locale}/blogg/${post.slug}`}
              className="flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-linePrimary shadow-sm sm:w-1/2 lg:w-1/3"
            >
              <div className="aspect-[16/9] bg-linePrimary/40">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-2 font-bold text-textcolor">{getLocalizedText(post.title, locale)}</h3>
                <p className="line-clamp-2 flex-1 text-sm text-textColorSecond">
                  {getLocalizedText(post.excerpt, locale)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
