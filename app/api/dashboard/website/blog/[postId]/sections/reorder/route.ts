import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { reorderSectionsSchema } from "@/lib/blog/blogPostSchemas";
import { applySectionPositions } from "@/lib/blog/sectionPositions";

type RouteParams = { params: Promise<{ postId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reorderSectionsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orderedIds = [...parsed.data]
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.id);

  const existingSections = await prisma.blogSection.findMany({
    where: { blogPostId: postId },
    select: { id: true },
  });
  const existingIds = new Set(existingSections.map((s) => s.id));
  const requestedIds = new Set(orderedIds);

  const isValidSet =
    existingIds.size === requestedIds.size &&
    [...existingIds].every((id) => requestedIds.has(id));

  if (!isValidSet) {
    return NextResponse.json({ ok: false, reason: "SECTION_SET_MISMATCH" }, { status: 422 });
  }

  await prisma.$transaction((tx) => applySectionPositions(tx, orderedIds));

  const sections = await prisma.blogSection.findMany({
    where: { blogPostId: postId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ ok: true, sections });
}
