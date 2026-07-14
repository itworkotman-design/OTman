import Image from "next/image";
import Link from "next/link";
import type { PublicBlogPostSummary, PublicBlogTag, BlogSortDirection } from "@/lib/blog/publicBlogQueries";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";

type Locale = "en" | "no";

const TEXT = {
  title: { en: "Blog", no: "Blogg" },
  intro: {
    en: "Read practical updates, delivery guidance, and behind-the-scenes notes from the Otman AS team.",
    no: "Les praktiske oppdateringer, leveringsråd og korte innblikk fra Otman AS-teamet.",
  },
  searchLabel: { en: "Search blogs", no: "Søk i blogg" },
  searchPlaceholder: { en: "Search by title or excerpt", no: "Søk etter tittel eller innhold" },
  sortLabel: { en: "Sort by date", no: "Sorter etter dato" },
  newestFirstLabel: { en: "Newest first", no: "Nyeste først" },
  oldestFirstLabel: { en: "Oldest first", no: "Eldste først" },
  submitLabel: { en: "Apply", no: "Bruk" },
  clearLabel: { en: "Clear", no: "Nullstill" },
  emptyTitle: { en: "No blogs found", no: "Ingen blogginnlegg funnet" },
  emptyText: { en: "Try another search term or clear the filters.", no: "Prøv et annet søkeord eller nullstill filtrene." },
  readTimeLabel: { en: "min read", no: "min lesing" },
  pinnedLabel: { en: "Pinned", no: "Fremhevet" },
  previousLabel: { en: "Previous", no: "Forrige" },
  nextLabel: { en: "Next", no: "Neste" },
  tagsLabel: { en: "Browse by tag", no: "Bla etter tag" },
  allTagsLabel: { en: "All", no: "Alle" },
};

const dateFormatterByLocale: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  no: new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", year: "numeric" }),
};

type BlogPageProps = {
  posts: PublicBlogPostSummary[];
  total: number;
  page: number;
  pageSize: number;
  locale: Locale;
  searchQuery: string;
  sortDirection: BlogSortDirection;
  tagSlug: string;
  availableTags: PublicBlogTag[];
};

function buildBlogUrl(
  locale: Locale,
  params: { q?: string; sort?: BlogSortDirection; page?: number; tag?: string },
) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.sort && params.sort !== "desc") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.tag) query.set("tag", params.tag);

  const queryString = query.toString();
  return `/${locale}/blogg${queryString ? `?${queryString}` : ""}`;
}

export default function BlogPage({
  posts,
  total,
  page,
  pageSize,
  locale,
  searchQuery,
  sortDirection,
  tagSlug,
  availableTags,
}: BlogPageProps) {
  const dateFormatter = dateFormatterByLocale[locale];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="py-12 md:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="mt-4 text-4xl font-bold text-logoblue md:text-5xl">{TEXT.title[locale]}</h1>
        <p className="mt-5 text-lg leading-8 text-textColorSecond">{TEXT.intro[locale]}</p>
      </section>

      {availableTags.length > 0 ? (
        <section className="mx-auto mt-8 max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-textColorSecond">
            {TEXT.tagsLabel[locale]}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection })}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                !tagSlug
                  ? "border-logoblue bg-logoblue text-white"
                  : "border-linePrimary text-textColorSecond hover:border-logoblue hover:text-logoblue"
              }`}
            >
              {TEXT.allTagsLabel[locale]}
            </Link>
            {availableTags.map((tag) => (
              <Link
                key={tag.slug}
                href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection, tag: tag.slug })}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  tagSlug === tag.slug
                    ? "border-logoblue bg-logoblue text-white"
                    : "border-linePrimary text-textColorSecond hover:border-logoblue hover:text-logoblue"
                }`}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 border-y border-lineSecondary py-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto_auto]" method="get">
          <input type="hidden" name="tag" value={tagSlug} />
          <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
            {TEXT.searchLabel[locale]}
            <input
              className="customInput font-normal"
              defaultValue={searchQuery}
              name="q"
              placeholder={TEXT.searchPlaceholder[locale]}
              type="search"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-textcolor">
            {TEXT.sortLabel[locale]}
            <select className="customInput font-normal" defaultValue={sortDirection} name="sort">
              <option value="desc">{TEXT.newestFirstLabel[locale]}</option>
              <option value="asc">{TEXT.oldestFirstLabel[locale]}</option>
            </select>
          </label>

          <div className="flex items-end">
            <button className="customButtonEnabled h-10 w-full" type="submit">
              {TEXT.submitLabel[locale]}
            </button>
          </div>

          <div className="flex items-end">
            <Link className="customButtonDefault flex h-10 w-full items-center justify-center" href={`/${locale}/blogg`}>
              {TEXT.clearLabel[locale]}
            </Link>
          </div>
        </form>
      </section>

      <section className="mt-10">
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const imageUrl = getPublicBlogImageUrl(post.coverImagePath);
              const readingTime = computeReadingTimeMinutes(post.sections, locale);

              return (
                <Link
                  href={`/${locale}/blogg/${post.slug}`}
                  key={post.id}
                  className="overflow-hidden rounded-lg border border-linePrimary bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[16/10]">
                    {imageUrl ? (
                      <Image
                        alt={getLocalizedText(post.coverImageAlt, locale)}
                        className="object-cover"
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        src={imageUrl}
                        unoptimized
                      />
                    ) : null}
                    {post.isPinned ? (
                      <span className="absolute right-3 top-3 rounded-full bg-logoblue px-2 py-1 text-xs font-semibold text-white">
                        {TEXT.pinnedLabel[locale]}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-64 flex-col p-5">
                    <time className="text-sm text-textColorSecond" dateTime={post.publishedAt?.toString()}>
                      {post.publishedAt ? dateFormatter.format(new Date(post.publishedAt)) : ""}
                    </time>
                    <h2 className="mt-4 text-xl font-bold leading-7 text-textcolor">
                      {getLocalizedText(post.title, locale)}
                    </h2>
                    <p className="mt-3 flex-1 leading-7 text-textColorSecond">
                      {getLocalizedText(post.excerpt, locale)}
                    </p>
                    {post.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
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
                      <span>{post.authorDisplayName ?? ""}</span>
                      <span>
                        {readingTime} {TEXT.readTimeLabel[locale]}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-lg border border-linePrimary px-6 py-12 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-logoblue">{TEXT.emptyTitle[locale]}</h2>
            <p className="mt-3 text-textColorSecond">{TEXT.emptyText[locale]}</p>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                className="customButtonDefault"
                href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection, page: page - 1, tag: tagSlug })}
              >
                {TEXT.previousLabel[locale]}
              </Link>
            ) : null}
            <span className="text-sm text-textColorSecond">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                className="customButtonDefault"
                href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection, page: page + 1, tag: tagSlug })}
              >
                {TEXT.nextLabel[locale]}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
