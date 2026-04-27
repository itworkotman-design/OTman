import BlogPage from "@/app/_components/site/pageComponents/BlogPage";
import { blogPageContent, type BlogSortDirection } from "@/lib/content/BlogContent";

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
