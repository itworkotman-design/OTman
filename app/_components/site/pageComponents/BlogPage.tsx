import Link from "next/link";
import type { PublicBlogPostSummary, PublicBlogTag, BlogSortDirection } from "@/lib/blog/publicBlogQueries";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";
import TagFilterDropdown from "@/app/_components/site/pageComponents/TagFilterDropdown";
import BlogListCard from "@/app/_components/blog/BlogListCard";

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
  tagLabel: { en: "Tags", no: "Tagger" },
  allTagsLabel: { en: "All tags", no: "Alle tagger" },
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
  tagSlugs: string[];
  availableTags: PublicBlogTag[];
};

function buildBlogUrl(
  locale: Locale,
  params: { q?: string; sort?: BlogSortDirection; page?: number; tags?: string[] },
) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.sort && params.sort !== "desc") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  for (const tag of params.tags ?? []) query.append("tag", tag);

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
  tagSlugs,
  availableTags,
}: BlogPageProps) {
  const dateFormatter = dateFormatterByLocale[locale];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="my-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold text-logoblue md:text-5xl">{TEXT.title[locale]}</h1>
        <p className="mt-5 text-lg leading-8 text-textColorSecond">{TEXT.intro[locale]}</p>
      </section>

      <section className="mt-12 border-y border-lineSecondary py-6">
        <form
          className={`grid gap-4 ${
            availableTags.length > 0 ? "md:grid-cols-[1fr_200px_200px_auto_auto]" : "md:grid-cols-[1fr_220px_auto_auto]"
          }`}
          method="get"
        >
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

          {availableTags.length > 0 ? (
            <TagFilterDropdown
              name="tag"
              label={TEXT.tagLabel[locale]}
              placeholderLabel={TEXT.allTagsLabel[locale]}
              availableTags={availableTags}
              initialSelected={tagSlugs}
            />
          ) : null}

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
              const readingTime = computeReadingTimeMinutes(post.sections, locale);

              return (
                <BlogListCard
                  key={post.id}
                  href={`/${locale}/blogg/${post.slug}`}
                  locale={locale}
                  title={post.title}
                  excerpt={post.excerpt}
                  coverImagePath={post.coverImagePath}
                  coverImageAlt={post.coverImageAlt}
                  isPinned={post.isPinned}
                  dateLabel={post.publishedAt ? dateFormatter.format(new Date(post.publishedAt)) : ""}
                  dateTimeAttr={post.publishedAt?.toString()}
                  authorDisplayName={post.authorDisplayName}
                  readingTime={readingTime}
                  readTimeLabel={TEXT.readTimeLabel[locale]}
                  pinnedLabel={TEXT.pinnedLabel[locale]}
                  tags={post.tags}
                />
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
                href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection, page: page - 1, tags: tagSlugs })}
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
                href={buildBlogUrl(locale, { q: searchQuery, sort: sortDirection, page: page + 1, tags: tagSlugs })}
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
