import Link from "next/link";
import type { PublicBlogPostSummary, PublicBlogPostWithSections } from "@/lib/blog/publicBlogQueries";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";
import BlogSectionRenderer from "@/app/_components/blog/BlogSectionRenderer";
import RelatedBlogPosts from "@/app/_components/blog/RelatedBlogPosts";

const SITE_BASE_URL = "https://otman.no";

type Locale = "en" | "no";

const TEXT = {
  backToBlog: { en: "Back to blog", no: "Tilbake til blogg" },
  readTimeLabel: { en: "min read", no: "min lesing" },
  updatedLabel: { en: "Updated", no: "Oppdatert" },
};

const dateFormatterByLocale: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  no: new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", year: "numeric" }),
};

type Props = {
  post: PublicBlogPostWithSections;
  locale: Locale;
  relatedPosts?: PublicBlogPostSummary[];
};

export default function BlogArticlePage({ post, locale, relatedPosts = [] }: Props) {
  const dateFormatter = dateFormatterByLocale[locale];
  const readingTime = computeReadingTimeMinutes(post.sections, locale);

  const canonicalUrl = `${SITE_BASE_URL}/${locale}/blogg/${post.slug}`;
  const imageUrl = getPublicBlogImageUrl(post.coverImagePath);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: getLocalizedText(post.title, locale),
    description: getLocalizedText(post.excerpt, locale),
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.authorDisplayName ? { "@type": "Person", name: post.authorDisplayName } : undefined,
    publisher: { "@type": "Organization", name: "Otman AS" },
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
  };

  return (
    <article className="py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <Link href={`/${locale}/blogg`} className="text-sm font-semibold text-logoblue">
          ← {TEXT.backToBlog[locale]}
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-logoblue md:text-5xl">
          {getLocalizedText(post.title, locale)}
        </h1>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-textColorSecond">
          {post.publishedAt ? <time dateTime={post.publishedAt.toString()}>{dateFormatter.format(new Date(post.publishedAt))}</time> : null}
          <span>·</span>
          <span>
            {readingTime} {TEXT.readTimeLabel[locale]}
          </span>
          {post.authorDisplayName ? (
            <>
              <span>·</span>
              <span>{post.authorDisplayName}</span>
            </>
          ) : null}
        </div>

        {post.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/${locale}/blogg?tag=${tag.slug}`}
                className="rounded-full border border-linePrimary px-3 py-1 text-xs font-semibold text-textColorSecond hover:border-logoblue hover:text-logoblue"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-10">
          <BlogSectionRenderer sections={post.sections} locale={locale} />
        </div>

        <div className="mt-12">
          <Link href={`/${locale}/blogg`} className="customButtonDefault">
            ← {TEXT.backToBlog[locale]}
          </Link>
        </div>

        <RelatedBlogPosts posts={relatedPosts} locale={locale} />
      </div>
    </article>
  );
}
