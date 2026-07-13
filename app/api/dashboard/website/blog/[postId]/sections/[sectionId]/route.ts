import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { blogSectionDataSchema } from "@/lib/blog/blogSectionSchemas";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";
import { applySectionPositions } from "@/lib/blog/sectionPositions";

type RouteParams = { params: Promise<{ postId: string; sectionId: string }> };

function sanitizeSectionData(data: ReturnType<typeof blogSectionDataSchema.parse>) {
  if (data.type === "RICH_TEXT" || data.type === "IMAGE_TEXT") {
    return {
      ...data,
      html: { en: sanitizeBlogHtml(data.html.en), no: sanitizeBlogHtml(data.html.no) },
    };
  }
  return data;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId, sectionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = blogSectionDataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.blogSection.findUnique({ where: { id: sectionId } });
  if (!existing || existing.blogPostId !== postId) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const sanitized = sanitizeSectionData(parsed.data);
  const { type, ...data } = sanitized;

  const section = await prisma.blogSection.update({
    where: { id: sectionId },
    data: { type, data },
  });

  return NextResponse.json({ ok: true, section });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId, sectionId } = await params;

  const existing = await prisma.blogSection.findUnique({ where: { id: sectionId } });
  if (!existing || existing.blogPostId !== postId) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.blogSection.delete({ where: { id: sectionId } });

    const remaining = await tx.blogSection.findMany({
      where: { blogPostId: postId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    await applySectionPositions(tx, remaining.map((s) => s.id));
  });

  const data = existing.data as Record<string, unknown>;
  const imagePaths: string[] = [];
  if (typeof data.storagePath === "string") imagePaths.push(data.storagePath);
  if (Array.isArray(data.images)) {
    for (const image of data.images) {
      if (image && typeof image.storagePath === "string") imagePaths.push(image.storagePath);
    }
  }
  await Promise.all(imagePaths.map((path) => deleteAttachmentFile(path).catch(() => {})));

  return NextResponse.json({ ok: true });
}
