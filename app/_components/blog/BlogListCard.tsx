// app/_components/blog/BlogListCard.tsx
import Link from "next/link";
import { getLocalizedText, type LocalizedTextValue } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import type { Locale } from "@/lib/content/NavbarContent";

type CardTag = { name: string; slug: string };

type Props = {
  // Omit href for a non-clickable preview (used by the admin editor's live
  // preview) — passing it renders the whole card as a link (the public list).
  href?: string;
  locale: Locale;
  title: LocalizedTextValue;
  titlePlaceholder?: string;
  excerpt: LocalizedTextValue;
  excerptPlaceholder?: string;
  coverImagePath: string | null;
  coverImageAlt?: LocalizedTextValue | null;
  isPinned: boolean;
  dateLabel: string;
  dateTimeAttr?: string;
  authorDisplayName: string | null;
  readingTime: number;
  readTimeLabel: string;
  pinnedLabel: string;
  tags?: CardTag[];
};

export default function BlogListCard({
  href,
  locale,
  title,
  titlePlaceholder = "",
  excerpt,
  excerptPlaceholder = "",
  coverImagePath,
  coverImageAlt,
  isPinned,
  dateLabel,
  dateTimeAttr,
  authorDisplayName,
  readingTime,
  readTimeLabel,
  pinnedLabel,
  tags = [],
}: Props) {
  const imageUrl = getPublicBlogImageUrl(coverImagePath);
  const titleText = getLocalizedText(title, locale) || titlePlaceholder;
  const excerptText = getLocalizedText(excerpt, locale) || excerptPlaceholder;

  const content = (
    <>
      <div className="relative h-44 shrink-0 bg-linePrimary/40">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={coverImageAlt ? getLocalizedText(coverImageAlt, locale) : ""}
            className="h-full w-full object-contain"
          />
        ) : null}
        {isPinned ? (
          <span
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-logoblue text-white shadow"
            title={pinnedLabel}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span className="sr-only">{pinnedLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="flex min-h-64 flex-1 flex-col overflow-hidden p-5">
        {dateTimeAttr ? (
          <time className="text-sm text-textColorSecond" dateTime={dateTimeAttr}>
            {dateLabel}
          </time>
        ) : (
          <span className="text-sm text-textColorSecond">{dateLabel}</span>
        )}
        <h2 className="mt-4 text-xl font-bold leading-7 text-textcolor">{titleText}</h2>
        <p className="mt-3 line-clamp-3 flex-1 leading-7 text-textColorSecond">{excerptText}</p>
        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.slug}
                className="rounded-full bg-linePrimary/30 px-2 py-0.5 text-xs font-semibold text-textColorSecond"
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-linePrimary pt-4 text-sm text-textColorSecond">
          <span>{authorDisplayName ?? ""}</span>
          <span>
            {readingTime} {readTimeLabel}
          </span>
        </div>
      </div>
    </>
  );

  const cardClassName = "flex max-h-140 flex-col overflow-hidden rounded-lg border border-linePrimary bg-white shadow-sm";

  if (href) {
    return (
      <Link href={href} className={`${cardClassName} transition hover:shadow-md`}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
