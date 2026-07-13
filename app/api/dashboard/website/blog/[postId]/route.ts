import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { updateBlogPostMetadataSchema } from "@/lib/blog/blogPostSchemas";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";

type RouteParams = { params: Promise<{ postId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { username: true, email: true } },
      sections: { orderBy: { position: "asc" } },
    },
  });

  if (!post) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, post });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateBlogPostMetadataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const value = parsed.data;

  if (value.slug && value.slug !== existing.slug) {
    const slugOwner = await prisma.blogPost.findUnique({ where: { slug: value.slug } });
    if (slugOwner && slugOwner.id !== postId) {
      return NextResponse.json({ ok: false, reason: "SLUG_TAKEN" }, { status: 409 });
    }
  }

  const post = await prisma.blogPost.update({
    where: { id: postId },
    data: {
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.slug !== undefined ? { slug: value.slug } : {}),
      ...(value.excerpt !== undefined ? { excerpt: value.excerpt } : {}),
      ...(value.seoTitle !== undefined ? { seoTitle: value.seoTitle ?? Prisma.JsonNull } : {}),
      ...(value.seoDescription !== undefined ? { seoDescription: value.seoDescription ?? Prisma.JsonNull } : {}),
      ...(value.coverImagePath !== undefined ? { coverImagePath: value.coverImagePath } : {}),
      ...(value.coverImageAlt !== undefined ? { coverImageAlt: value.coverImageAlt ?? Prisma.JsonNull } : {}),
      ...(value.authorDisplayName !== undefined ? { authorDisplayName: value.authorDisplayName } : {}),
    },
  });

  return NextResponse.json({ ok: true, post });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req, { ownerOnly: true });
  if ("error" in auth) return auth.error;

  const { postId } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { sections: true },
  });

  if (!post) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.blogPost.delete({ where: { id: postId } });

  const imagePaths: string[] = [];
  if (post.coverImagePath) imagePaths.push(post.coverImagePath);
  for (const section of post.sections) {
    const data = section.data as Record<string, unknown>;
    if (typeof data.storagePath === "string") imagePaths.push(data.storagePath);
    if (Array.isArray(data.images)) {
      for (const image of data.images) {
        if (image && typeof image.storagePath === "string") imagePaths.push(image.storagePath);
      }
    }
  }

  await Promise.all(imagePaths.map((path) => deleteAttachmentFile(path).catch(() => {})));

  return NextResponse.json({ ok: true });
}
