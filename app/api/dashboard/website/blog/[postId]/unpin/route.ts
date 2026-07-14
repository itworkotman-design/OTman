import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;

  const existing = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const post = await prisma.blogPost.update({
    where: { id: postId },
    data: { isPinned: false, pinnedAt: null },
  });

  return NextResponse.json({ ok: true, post });
}
