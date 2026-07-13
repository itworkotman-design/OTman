import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogArticlePage from "@/app/_components/site/pageComponents/BlogArticlePage";
import { getPublishedBlogPostBySlug } from "@/lib/blog/publicBlogQueries";
import { getLocalizedText } from "@/lib/blog/localizedText";
import { getPublicBlogImageUrl } from "@/lib/blog/publicImageUrl";

type PageParams = {
  params: Promise<{ locale: "en" | "no"; slug: string }>;
};

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) {
    return { robots: { index: false, follow: false } };
  }

  const title = getLocalizedText(post.seoTitle, locale) || getLocalizedText(post.title, locale);
  const description = getLocalizedText(post.seoDescription, locale) || getLocalizedText(post.excerpt, locale);
  const imageUrl = getPublicBlogImageUrl(post.coverImagePath);

  return {
    title,
    description,
    alternates: { canonical: `/${locale}/blogg/${post.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function Page({ params }: PageParams) {
  const { locale, slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();

  return <BlogArticlePage post={post} locale={locale} />;
}
