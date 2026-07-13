import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { createBlogPostSchema } from "@/lib/blog/blogPostSchemas";
import { generateUniqueBlogSlug } from "@/lib/blog/slug";

const DEFAULT_ROWS_PER_PAGE = 20;

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PINNED";

function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED" || value === "PINNED") {
    return value;
  }
  return "ALL";
}

export async function GET(req: Request) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = parseStatusFilter(url.searchParams.get("status"));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const rowsPerPage = Math.max(1, Number(url.searchParams.get("rowsPerPage")) || DEFAULT_ROWS_PER_PAGE);

  const where = {
    ...(status === "PINNED" ? { isPinned: true } : {}),
    ...(status === "DRAFT" || status === "PUBLISHED" || status === "ARCHIVED"
      ? { status }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { path: ["en"], string_contains: q, mode: "insensitive" as const } },
            { title: { path: ["no"], string_contains: q, mode: "insensitive" as const } },
            { excerpt: { path: ["en"], string_contains: q, mode: "insensitive" as const } },
            { excerpt: { path: ["no"], string_contains: q, mode: "insensitive" as const } },
            { slug: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, posts, counts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
      include: {
        author: { select: { username: true, email: true } },
        _count: { select: { sections: true } },
      },
    }),
    prisma.blogPost.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const row of counts) {
    statusCounts[row.status] = row._count._all;
  }

  return NextResponse.json({
    ok: true,
    posts,
    total,
    page,
    rowsPerPage,
    statusCounts,
  });
}

export async function POST(req: Request) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createBlogPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const value = parsed.data;

  if (value.slug) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: value.slug } });
    if (existing) {
      return NextResponse.json({ ok: false, reason: "SLUG_TAKEN" }, { status: 409 });
    }
  }

  const slug = value.slug ?? (await generateUniqueBlogSlug(value.title.no || value.title.en));

  const post = await prisma.blogPost.create({
    data: {
      slug,
      title: value.title,
      excerpt: value.excerpt,
      seoTitle: value.seoTitle ?? undefined,
      seoDescription: value.seoDescription ?? undefined,
      coverImagePath: value.coverImagePath,
      coverImageAlt: value.coverImageAlt ?? undefined,
      authorDisplayName: value.authorDisplayName,
      isPinned: value.isPinned ?? false,
      pinnedAt: value.isPinned ? new Date() : null,
      authorId: auth.session.userId,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ ok: true, post });
}
