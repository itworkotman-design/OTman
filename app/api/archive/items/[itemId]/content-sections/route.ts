import { NextResponse } from "next/server";
import type { ArchiveContentSectionType } from "@prisma/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { createContentSection, listContentSections } from "@/lib/docArchive/contentSections";

const SECTION_TYPES: ArchiveContentSectionType[] = ["IMAGES", "FILES", "TEXT_FIELDS"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const sections = await listContentSections(ctx.companyId, ctx.tenantId, itemId);

  return NextResponse.json({ ok: true, sections });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const type = body?.type;

  if (!SECTION_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const section = await createContentSection(ctx.companyId, ctx.tenantId, itemId, type);

  return NextResponse.json({ ok: true, section }, { status: 201 });
}
