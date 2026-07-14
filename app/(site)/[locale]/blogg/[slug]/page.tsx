import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogArticlePage from "@/app/_components/site/pageComponents/BlogArticlePage";
import { getPublishedBlogPostBySlug, getRelatedBlogPosts } from "@/lib/blog/publicBlogQueries";
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
    ...(post.noIndex ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: `/${locale}/blogg/${post.slug}`,
      languages: {
        en: `/en/blogg/${post.slug}`,
        no: `/no/blogg/${post.slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: post.authorDisplayName ? [post.authorDisplayName] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function Page({ params }: PageParams) {
  const { locale, slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();

  const relatedPosts = await getRelatedBlogPosts({
    excludePostId: post.id,
    tagSlugs: post.tags.map((tag) => tag.slug),
  });

  return <BlogArticlePage post={post} locale={locale} relatedPosts={relatedPosts} />;
}
