import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { getContentSection } from "@/lib/docArchive/contentSections";
import { getOrCreateYoutubeEmbed, updateYoutubeEmbed } from "@/lib/docArchive/youtubeEmbeds";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);

  const section = await getContentSection(ctx.companyId, ctx.tenantId, sectionId);
  if (!section) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const { url, title } = await getOrCreateYoutubeEmbed(ctx.companyId, ctx.tenantId, section.itemId, sectionId);
  return NextResponse.json({ ok: true, url, title });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const body = await req.json().catch(() => null);

  const ctx = buildArchiveContext(result.session, result.membership);
  const section = await getContentSection(ctx.companyId, ctx.tenantId, sectionId);
  if (!section) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const updateResult = await updateYoutubeEmbed(ctx.companyId, ctx.tenantId, section.itemId, sectionId, body?.url, body?.title);
  if (!updateResult.ok) {
    return NextResponse.json({ ok: false, reason: updateResult.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
