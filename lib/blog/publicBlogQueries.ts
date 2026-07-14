import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/content/NavbarContent";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";
import type { BlogSectionData } from "@/lib/blog/blogSectionSchemas";

export type BlogSortDirection = "asc" | "desc";

export type PublicBlogTag = { name: string; slug: string };

export type PublicBlogPostSummary = {
  id: string;
  slug: string;
  title: LocalizedTextValue;
  excerpt: LocalizedTextValue;
  coverImagePath: string | null;
  coverImageAlt: LocalizedTextValue | null;
  isPinned: boolean;
  pinnedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorDisplayName: string | null;
  authorUsername: string | null;
  sections: BlogSectionData[];
  tags: PublicBlogTag[];
};

export type PublicBlogPostWithSections = PublicBlogPostSummary & {
  seoTitle: LocalizedTextValue | null;
  seoDescription: LocalizedTextValue | null;
  noIndex: boolean;
  updatedAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  seoTitle: true,
  seoDescription: true,
  noIndex: true,
  coverImagePath: true,
  coverImageAlt: true,
  isPinned: true,
  pinnedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authorDisplayName: true,
  author: { select: { username: true, email: true } },
  sections: { orderBy: { position: "asc" as const }, select: { type: true, data: true } },
  tags: { select: { blogTag: { select: { name: true, slug: true } } } },
} as const;

function toSummary(post: {
  id: string;
  slug: string;
  title: unknown;
  excerpt: unknown;
  coverImagePath: string | null;
  coverImageAlt: unknown;
  isPinned: boolean;
  pinnedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorDisplayName: string | null;
  author: { username: string | null; email: string } | null;
  sections: { type: string; data: unknown }[];
  tags: { blogTag: PublicBlogTag }[];
}): PublicBlogPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title as LocalizedTextValue,
    excerpt: post.excerpt as LocalizedTextValue,
    coverImagePath: post.coverImagePath,
    coverImageAlt: post.coverImageAlt as LocalizedTextValue | null,
    isPinned: post.isPinned,
    pinnedAt: post.pinnedAt,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    authorDisplayName: post.authorDisplayName ?? post.author?.username ?? null,
    authorUsername: post.author?.username ?? null,
    sections: post.sections.map((s) => ({ type: s.type, ...(s.data as object) })) as BlogSectionData[],
    tags: post.tags.map((t) => t.blogTag),
  };
}

export async function getPublishedBlogPosts(params: {
  q?: string;
  sort?: BlogSortDirection;
  page?: number;
  pageSize?: number;
  locale: Locale;
  tagSlug?: string;
}): Promise<{ posts: PublicBlogPostSummary[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 9);
  const searchQuery = (params.q ?? "").trim();

  const where = {
    status: "PUBLISHED" as const,
    ...(searchQuery
      ? {
          OR: [
            { title: { path: [params.locale], string_contains: searchQuery, mode: "insensitive" as const } },
            { excerpt: { path: [params.locale], string_contains: searchQuery, mode: "insensitive" as const } },
            { slug: { contains: searchQuery, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.tagSlug ? { tags: { some: { blogTag: { slug: params.tagSlug } } } } : {}),
  };

  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: params.sort === "asc" ? "asc" : "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { posts: posts.map(toSummary), total };
}

export async function getRelatedBlogPosts(params: {
  excludePostId: string;
  tagSlugs?: string[];
  limit?: number;
}): Promise<PublicBlogPostSummary[]> {
  const limit = params.limit ?? 6;
  const tagSlugs = params.tagSlugs ?? [];
  const usedIds = new Set([params.excludePostId]);
  const results: PublicBlogPostSummary[] = [];

  // Prefer posts sharing at least one tag, ranked by how many tags they
  // share, before falling back to "just recent" — tags are the only real
  // relevance signal available, so use them when a post has any.
  if (tagSlugs.length > 0) {
    const candidates = await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        id: { not: params.excludePostId },
        tags: { some: { blogTag: { slug: { in: tagSlugs } } } },
      },
      select: PUBLIC_SELECT,
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit * 4,
    });

    const ranked = candidates
      .map((post) => ({
        post,
        matchCount: post.tags.filter((t) => tagSlugs.includes(t.blogTag.slug)).length,
      }))
      .sort((a, b) => b.matchCount - a.matchCount);

    for (const { post } of ranked) {
      if (results.length >= limit) break;
      results.push(toSummary(post));
      usedIds.add(post.id);
    }
  }

  if (results.length < limit) {
    const fillerPosts = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", id: { notIn: Array.from(usedIds) } },
      select: PUBLIC_SELECT,
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit - results.length,
    });
    results.push(...fillerPosts.map(toSummary));
  }

  return results;
}

export async function getPublishedBlogTags(): Promise<PublicBlogTag[]> {
  return prisma.blogTag.findMany({
    where: { posts: { some: { blogPost: { status: "PUBLISHED" } } } },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

export async function getPublishedBlogSlugsForSitemap(): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPublishedBlogPostBySlug(
  slug: string,
): Promise<PublicBlogPostWithSections | null> {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: PUBLIC_SELECT,
  });

  if (!post) return null;

  return {
    ...toSummary(post),
    seoTitle: post.seoTitle as LocalizedTextValue | null,
    seoDescription: post.seoDescription as LocalizedTextValue | null,
    noIndex: post.noIndex,
    updatedAt: post.updatedAt,
  };
}
