import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { renameTagSchema } from "@/lib/blog/blogTagSchemas";

type RouteParams = { params: Promise<{ tagId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { tagId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = renameTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.blogTag.findUnique({ where: { id: tagId } });
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const tag = await prisma.blogTag.update({
    where: { id: tagId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, tag });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const { tagId } = await params;

  const existing = await prisma.blogTag.findUnique({ where: { id: tagId } });
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.blogTag.delete({ where: { id: tagId } });

  return NextResponse.json({ ok: true });
}
