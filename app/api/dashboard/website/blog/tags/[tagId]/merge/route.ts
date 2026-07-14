import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { mergeTagSchema } from "@/lib/blog/blogTagSchemas";
import { mergeBlogTags } from "@/lib/blog/blogTags";

type RouteParams = { params: Promise<{ tagId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { tagId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = mergeTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.intoTagId === tagId) {
    return NextResponse.json({ ok: false, reason: "CANNOT_MERGE_INTO_SELF" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.blogTag.findUnique({ where: { id: tagId } }),
    prisma.blogTag.findUnique({ where: { id: parsed.data.intoTagId } }),
  ]);

  if (!source || !target) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await mergeBlogTags(tagId, parsed.data.intoTagId);

  return NextResponse.json({ ok: true });
}
