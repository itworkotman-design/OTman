import type { Metadata } from "next";
import BlogPage from "@/app/_components/site/pageComponents/BlogPage";
import { getPublishedBlogPosts, type BlogSortDirection } from "@/lib/blog/publicBlogQueries";

const PAGE_SIZE = 9;

type BlogSearchParams = {
  q?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getSortDirection(value: string): BlogSortDirection {
  return value === "asc" ? "asc" : "desc";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "no" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "no" ? "Blogg" : "Blog";
  const description =
    locale === "no"
      ? "Praktiske oppdateringer, leveringsråd og innblikk fra Otman AS-teamet."
      : "Practical updates, delivery guidance, and notes from the Otman AS team.";

  return {
    title,
    description,
    alternates: { canonical: `/${locale}/blogg` },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "en" | "no" }>;
  searchParams: Promise<BlogSearchParams>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const searchQuery = getSingleParam(resolvedSearchParams.q);
  const sortDirection = getSortDirection(getSingleParam(resolvedSearchParams.sort));
  const page = Math.max(1, Number(getSingleParam(resolvedSearchParams.page)) || 1);

  const { posts, total } = await getPublishedBlogPosts({
    q: searchQuery,
    sort: sortDirection,
    page,
    pageSize: PAGE_SIZE,
    locale,
  });

  return (
    <BlogPage
      posts={posts}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      locale={locale}
      searchQuery={searchQuery}
      sortDirection={sortDirection}
    />
  );
}
