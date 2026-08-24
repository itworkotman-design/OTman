// app/_components/blog/BlogCarousel.tsx
"use client";

import { ImageCarousel } from "./ImageCarousel";
import type { CarouselSectionData } from "@/lib/blog/blogSectionSchemas";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import type { Locale } from "@/lib/content/NavbarContent";

type Props = {
  section: CarouselSectionData;
  locale: Locale;
};

export default function BlogCarousel({ section, locale }: Props) {
  const images = section.images
    .map((image) => {
      const src = getPublicBlogImageUrl(image.storagePath);
      if (!src) return null;
      return {
        src,
        alt: getLocalizedText(image.alt, locale),
        caption: getLocalizedText(image.caption, locale) || undefined,
      };
    })
    .filter((image): image is NonNullable<typeof image> => image !== null);

  return (
    <ImageCarousel
      images={images}
      autoplay={section.autoplay}
      intervalSeconds={section.intervalSeconds ?? 5}
    />
  );
}
