import Link from "next/link";
import type { PublicBlogPostWithSections } from "@/lib/blog/publicBlogQueries";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";
import BlogSectionRenderer from "@/app/_components/blog/BlogSectionRenderer";

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
};

export default function BlogArticlePage({ post, locale }: Props) {
  const dateFormatter = dateFormatterByLocale[locale];
  const readingTime = computeReadingTimeMinutes(post.sections, locale);

  return (
    <article className="py-12 md:py-16">
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

        <div className="mt-10">
          <BlogSectionRenderer sections={post.sections} locale={locale} />
        </div>

        <div className="mt-12">
          <Link href={`/${locale}/blogg`} className="customButtonDefault">
            ← {TEXT.backToBlog[locale]}
          </Link>
        </div>
      </div>
    </article>
  );
}
