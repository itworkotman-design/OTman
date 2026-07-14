import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { blogSectionDataSchema, isSectionNonEmpty } from "@/lib/blog/blogSectionSchemas";
import { slugSchema } from "@/lib/blog/blogPostSchemas";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { sections: { orderBy: { position: "asc" } } },
  });

  if (!post) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const title = post.title as { en?: string; no?: string } | null;
  const hasTitle = Boolean(title?.en?.trim() || title?.no?.trim());
  const hasValidSlug = slugSchema.safeParse(post.slug).success;
  const hasNonEmptySection = post.sections.some((section) => {
    const parsed = blogSectionDataSchema.safeParse({ type: section.type, ...(section.data as object) });
    return parsed.success && isSectionNonEmpty(parsed.data);
  });

  if (!hasTitle || !hasValidSlug || !hasNonEmptySection) {
    return NextResponse.json(
      {
        ok: false,
        reason: "PUBLISH_REQUIREMENTS_NOT_MET",
        details: { hasTitle, hasValidSlug, hasNonEmptySection },
      },
      { status: 422 },
    );
  }

  const updated = await prisma.blogPost.update({
    where: { id: postId },
    data: {
      status: "PUBLISHED",
      publishedAt: post.publishedAt ?? new Date(),
      archivedAt: null,
    },
  });

  return NextResponse.json({ ok: true, post: updated });
}
