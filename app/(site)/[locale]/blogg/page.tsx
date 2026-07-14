import type { Metadata } from "next";
import BlogPage from "@/app/_components/site/pageComponents/BlogPage";
import { blogPageContent, type BlogSortDirection } from "@/lib/content/BlogContent";
import { buildAlternates } from "@/lib/site/seo";

type BlogSearchParams = {
  q?: string | string[];
  sort?: string | string[];
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
  const title =
    locale === "no"
      ? "Blogg – nyheter, tips og oppdateringer om transport"
      : "Blog – News, Tips and Updates on Transport and Moving";
  return { title, alternates: buildAlternates(locale, "/blogg") };
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

  return (
    <BlogPage
      content={blogPageContent}
      locale={locale}
      searchQuery={searchQuery}
      sortDirection={sortDirection}
    />
  );
}
