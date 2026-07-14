import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { updatePostTagsSchema } from "@/lib/blog/blogTagSchemas";
import { setPostTags } from "@/lib/blog/blogTags";

type RouteParams = { params: Promise<{ postId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePostTagsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.blogPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await setPostTags(postId, parsed.data.tagNames);

  return NextResponse.json({ ok: true });
}
