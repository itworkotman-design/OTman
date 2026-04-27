import Image from "next/image";
import Link from "next/link";
import { blogPageContent, type BlogPost, type BlogSortDirection } from "@/lib/content/BlogContent";

type Locale = "en" | "no";

type BlogPageProps = {
  content: typeof blogPageContent;
  locale: Locale;
  searchQuery: string;
  sortDirection: BlogSortDirection;
};

const dateFormatterByLocale: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  no: new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
};

function buildBlogSearchText(post: BlogPost, locale: Locale) {
  return [
    post.title[locale],
    post.excerpt[locale],
    post.category[locale],
    post.author,
  ]
    .join(" ")
    .toLowerCase();
}

function getVisiblePosts(
  posts: BlogPost[],
  locale: Locale,
  searchQuery: string,
  sortDirection: BlogSortDirection,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPosts = normalizedQuery
    ? posts.filter((post) => buildBlogSearchText(post, locale).includes(normalizedQuery))
    : posts;

  return filteredPosts.toSorted((firstPost, secondPost) => {
    const firstTime = new Date(firstPost.publishedAt).getTime();
    const secondTime = new Date(secondPost.publishedAt).getTime();

    return sortDirection === "asc" ? firstTime - secondTime : secondTime - firstTime;
  });
}

export default function BlogPage({
  content,
  locale,
  searchQuery,
  sortDirection,
}: BlogPageProps) {
  const posts = getVisiblePosts(content.posts, locale, searchQuery, sortDirection);
  const dateFormatter = dateFormatterByLocale[locale];

  return (
    <div className="py-12 md:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="mt-4 text-4xl font-bold text-logoblue md:text-5xl">
          {content.title[locale]}
        </h1>
        <p className="mt-5 text-lg leading-8 text-textColorSecond">
          {content.intro[locale]}
        </p>
      </section>

      <section className="mt-12 border-y border-lineSecondary py-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto_auto]" method="get">
          <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
            {content.searchLabel[locale]}
            <input
              className="customInput font-normal"
              defaultValue={searchQuery}
              name="q"
              placeholder={content.searchPlaceholder[locale]}
              type="search"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
            {content.sortLabel[locale]}
            <select
              className="customInput font-normal"
              defaultValue={sortDirection}
              name="sort"
            >
              <option value="desc">{content.newestFirstLabel[locale]}</option>
              <option value="asc">{content.oldestFirstLabel[locale]}</option>
            </select>
          </label>

          <div className="flex items-end">
            <button className="customButtonEnabled h-10 w-full" type="submit">
              {content.submitLabel[locale]}
            </button>
          </div>

          <div className="flex items-end">
            <Link
              className="customButtonDefault flex h-10 w-full items-center justify-center"
              href={`/${locale}/blogg`}
            >
              {content.clearLabel[locale]}
            </Link>
          </div>
        </form>
      </section>

      <section className="mt-10">
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                className="overflow-hidden rounded-lg border border-linePrimary bg-white shadow-sm"
                key={post.id}
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    src={post.imageSrc}
                  />
                </div>
                <div className="flex min-h-64 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-textColorSecond">
                    <span className="font-semibold text-logoblue">
                      {post.category[locale]}
                    </span>
                    <span aria-hidden="true">/</span>
                    <time dateTime={post.publishedAt}>
                      {dateFormatter.format(new Date(post.publishedAt))}
                    </time>
                  </div>
                  <h2 className="mt-4 text-xl font-bold leading-7 text-textcolor">
                    {post.title[locale]}
                  </h2>
                  <p className="mt-3 flex-1 leading-7 text-textColorSecond">
                    {post.excerpt[locale]}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-linePrimary pt-4 text-sm text-textColorSecond">
                    <span>{post.author}</span>
                    <span>
                      {post.readTimeMinutes} {content.readTimeLabel[locale]}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-lg border border-linePrimary px-6 py-12 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-logoblue">
              {content.emptyTitle[locale]}
            </h2>
            <p className="mt-3 text-textColorSecond">{content.emptyText[locale]}</p>
          </div>
        )}
      </section>
    </div>
  );
}
