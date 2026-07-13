// app/(User)/dashboard/website/blog/[postId]/preview/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import BlogSectionRenderer from "@/app/_components/blog/BlogSectionRenderer";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";
import { getLocalizedText, type LocalizedTextValue } from "@/lib/blog/localizedText";
import { computeReadingTimeMinutes } from "@/lib/blog/readingTime";
import type { BlogSectionData } from "@/lib/blog/blogSectionSchemas";
import type { Locale } from "@/lib/content/NavbarContent";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageParams = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ locale?: string }>;
};

export default async function BlogPreviewPage({ params, searchParams }: PageParams) {
  const { postId } = await params;
  const { locale: rawLocale } = await searchParams;
  const locale: Locale = rawLocale === "en" ? "en" : "no";

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { sections: { orderBy: { position: "asc" } } },
  });

  if (!post) notFound();

  const title = post.title as LocalizedTextValue;
  const excerpt = post.excerpt as LocalizedTextValue;
  const coverImageUrl = getPublicBlogImageUrl(post.coverImagePath);
  const sections = post.sections.map((s) => ({ type: s.type, ...(s.data as object) })) as BlogSectionData[];
  const readingTime = computeReadingTimeMinutes(sections, locale);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-4 rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Preview mode ({post.status}) — not publicly visible.
      </div>
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="mb-6 aspect-[16/9] w-full rounded-lg object-cover" />
      ) : null}
      <h1 className="text-3xl font-bold text-textcolor md:text-4xl">{getLocalizedText(title, locale)}</h1>
      <p className="mt-3 text-lg text-textColorSecond">{getLocalizedText(excerpt, locale)}</p>
      <div className="mt-2 text-sm text-textColorSecond">{readingTime} min read</div>
      <div className="mt-8">
        <BlogSectionRenderer sections={sections} locale={locale} />
      </div>
    </div>
  );
}
