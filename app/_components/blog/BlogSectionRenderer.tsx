// app/_components/blog/BlogSectionRenderer.tsx
import type { Locale } from "@/lib/content/NavbarContent";
import { blogSectionDataSchema, type BlogSectionData } from "@/lib/blog/blogSectionSchemas";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import BlogCarousel from "@/app/_components/blog/BlogCarousel";

type Props = {
  sections: BlogSectionData[];
  locale: Locale;
};

const WIDTH_CLASS: Record<string, string> = {
  small: "max-w-sm",
  medium: "max-w-2xl",
  full: "max-w-full",
};

const ALIGN_CLASS: Record<string, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

const SPACER_HEIGHT: Record<string, string> = {
  small: "h-4",
  medium: "h-8",
  large: "h-16",
};

function RenderedSection({ section, locale }: { section: BlogSectionData; locale: Locale }) {
  switch (section.type) {
    case "RICH_TEXT":
      return (
        <div
          className="rich-text-content prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.html, locale)) }}
        />
      );
    case "IMAGE": {
      const url = getPublicBlogImageUrl(section.storagePath);
      if (!url) return null;
      return (
        <figure className={`${WIDTH_CLASS[section.width ?? "full"]} ${ALIGN_CLASS[section.alignment ?? "center"]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={getLocalizedText(section.alt, locale)} className="w-full rounded-md object-cover" />
          {getLocalizedText(section.caption, locale) ? (
            <figcaption className="mt-2 text-center text-sm text-textColorSecond">
              {getLocalizedText(section.caption, locale)}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "IMAGE_TEXT": {
      const url = getPublicBlogImageUrl(section.storagePath);
      const reverse = section.imagePosition === "right";
      return (
        <div className={`flex flex-col gap-6 md:flex-row ${reverse ? "md:flex-row-reverse" : ""}`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={getLocalizedText(section.alt, locale)} className="w-full rounded-md object-cover md:w-1/2" />
          ) : null}
          <div className="md:w-1/2">
            {getLocalizedText(section.heading, locale) ? (
              <div
                className="rich-text-content text-xl font-bold text-textcolor [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.heading, locale)) }}
              />
            ) : null}
            <div
              className="rich-text-content prose mt-2 max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.html, locale)) }}
            />
          </div>
        </div>
      );
    }
    case "GALLERY":
      return (
        <div className={`grid gap-4 ${section.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {section.images.map((image, index) => {
            const url = getPublicBlogImageUrl(image.storagePath);
            if (!url) return null;
            return (
              <figure key={index}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={getLocalizedText(image.alt, locale)} className="aspect-[4/3] w-full rounded-md object-cover" />
                {getLocalizedText(image.caption, locale) ? (
                  <figcaption className="mt-1 text-center text-xs text-textColorSecond">
                    {getLocalizedText(image.caption, locale)}
                  </figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      );
    case "CAROUSEL":
      return <BlogCarousel section={section} locale={locale} />;
    case "QUOTE":
      return (
        <blockquote className="border-l-4 border-logoblue pl-4 italic text-textcolor">
          <div
            className="rich-text-content text-lg [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.quote, locale)) }}
          />
          {getLocalizedText(section.attribution, locale) ? (
            <div
              className="rich-text-content mt-2 text-sm not-italic text-textColorSecond [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.attribution, locale)) }}
            />
          ) : null}
        </blockquote>
      );
    case "CTA":
      return (
        <div className="rounded-lg border border-linePrimary bg-linePrimary/20 p-6 text-center">
          {getLocalizedText(section.heading, locale) ? (
            <div
              className="rich-text-content text-xl font-bold text-textcolor [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.heading, locale)) }}
            />
          ) : null}
          {getLocalizedText(section.text, locale) ? (
            <div
              className="rich-text-content mt-2 text-textColorSecond [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(getLocalizedText(section.text, locale)) }}
            />
          ) : null}
          <a
            href={section.buttonUrl}
            target={section.openInNewTab ? "_blank" : undefined}
            rel={section.openInNewTab ? "noopener noreferrer" : undefined}
            className="customButtonEnabled mt-4 inline-block"
          >
            {getLocalizedText(section.buttonLabel, locale)}
          </a>
        </div>
      );
    case "DIVIDER": {
      const thicknessPx = { thin: 1, medium: 2, thick: 4 }[section.thickness ?? "medium"];
      return (
        <hr
          className={section.style === "dashed" ? "border-dashed" : "border-solid"}
          style={{
            borderTopWidth: `${thicknessPx}px`,
            borderTopColor: section.color ?? "#d1d5db",
          }}
        />
      );
    }
    case "SPACER":
      return <div className={SPACER_HEIGHT[section.size]} aria-hidden="true" />;
    default:
      return null;
  }
}

export default function BlogSectionRenderer({ sections, locale }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section, index) => {
        const parsed = blogSectionDataSchema.safeParse(section);
        if (!parsed.success) return null;
        return <RenderedSection key={index} section={parsed.data} locale={locale} />;
      })}
    </div>
  );
}
