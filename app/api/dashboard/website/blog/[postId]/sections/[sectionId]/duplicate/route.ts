import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { applySectionPositions } from "@/lib/blog/sectionPositions";

type RouteParams = { params: Promise<{ postId: string; sectionId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId, sectionId } = await params;

  const original = await prisma.blogSection.findUnique({ where: { id: sectionId } });
  if (!original || original.blogPostId !== postId) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const newSection = await prisma.$transaction(async (tx) => {
    const siblings = await tx.blogSection.findMany({
      where: { blogPostId: postId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const created = await tx.blogSection.create({
      data: {
        blogPostId: postId,
        type: original.type,
        position: siblings.length + 1_000_000,
        data: original.data as object,
      },
    });

    const originalIndex = siblings.findIndex((s) => s.id === sectionId);
    const orderedIds = siblings.map((s) => s.id);
    orderedIds.splice(originalIndex + 1, 0, created.id);

    await applySectionPositions(tx, orderedIds);

    return created;
  });

  return NextResponse.json({ ok: true, section: newSection });
}
