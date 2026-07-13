import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/content/NavbarContent";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";
import type { BlogSectionData } from "@/lib/blog/blogSectionSchemas";

export type BlogSortDirection = "asc" | "desc";

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
};

export type PublicBlogPostWithSections = PublicBlogPostSummary & {
  seoTitle: LocalizedTextValue | null;
  seoDescription: LocalizedTextValue | null;
  updatedAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  seoTitle: true,
  seoDescription: true,
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
  };
}

export async function getPublishedBlogPosts(params: {
  q?: string;
  sort?: BlogSortDirection;
  page?: number;
  pageSize?: number;
  locale: Locale;
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
    updatedAt: post.updatedAt,
  };
}
