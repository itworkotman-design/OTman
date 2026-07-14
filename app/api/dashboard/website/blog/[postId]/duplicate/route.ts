import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { generateUniqueBlogSlug } from "@/lib/blog/slug";
import type { LocalizedTextValue } from "@/lib/blog/localizedText";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;

  const original = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { sections: { orderBy: { position: "asc" } } },
  });

  if (!original) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const originalTitle = original.title as LocalizedTextValue;
  const copyTitle: LocalizedTextValue = {
    en: `${originalTitle.en} (Copy)`.trim(),
    no: `${originalTitle.no} (Copy)`.trim(),
  };
  const newSlug = await generateUniqueBlogSlug(`${original.slug}-copy`);

  const duplicated = await prisma.$transaction(async (tx) => {
    const newPost = await tx.blogPost.create({
      data: {
        slug: newSlug,
        status: "DRAFT",
        title: copyTitle,
        excerpt: original.excerpt as object,
        seoTitle: original.seoTitle as object | null ?? undefined,
        seoDescription: original.seoDescription as object | null ?? undefined,
        noIndex: original.noIndex,
        coverImagePath: original.coverImagePath,
        coverImageAlt: original.coverImageAlt as object | null ?? undefined,
        authorDisplayName: original.authorDisplayName,
        authorId: auth.session.userId,
        isPinned: false,
        pinnedAt: null,
        publishedAt: null,
      },
    });

    if (original.sections.length > 0) {
      await tx.blogSection.createMany({
        data: original.sections.map((section) => ({
          blogPostId: newPost.id,
          type: section.type,
          position: section.position,
          data: section.data as object,
        })),
      });
    }

    return newPost;
  });

  return NextResponse.json({ ok: true, post: duplicated });
}
