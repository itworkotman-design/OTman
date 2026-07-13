import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { blogSectionDataSchema } from "@/lib/blog/blogSectionSchemas";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

type RouteParams = { params: Promise<{ postId: string }> };

function sanitizeSectionData(data: ReturnType<typeof blogSectionDataSchema.parse>) {
  if (data.type === "RICH_TEXT" || data.type === "IMAGE_TEXT") {
    return {
      ...data,
      html: { en: sanitizeBlogHtml(data.html.en), no: sanitizeBlogHtml(data.html.no) },
    };
  }
  return data;
}

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = blogSectionDataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const sanitized = sanitizeSectionData(parsed.data);
  const { type, ...data } = sanitized;

  const count = await prisma.blogSection.count({ where: { blogPostId: postId } });

  const section = await prisma.blogSection.create({
    data: {
      blogPostId: postId,
      type,
      position: count,
      data,
    },
  });

  return NextResponse.json({ ok: true, section });
}
