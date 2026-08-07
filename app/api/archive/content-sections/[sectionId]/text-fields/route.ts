import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { getContentSection } from "@/lib/docArchive/contentSections";
import { createSectionTextField, listSectionTextFields } from "@/lib/docArchive/textFields";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

const MAX_LABEL_LENGTH = 200;
const MAX_VALUE_LENGTH = 20000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const fields = await listSectionTextFields(ctx.companyId, ctx.tenantId, sectionId);

  return NextResponse.json({ ok: true, fields });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { sectionId } = await params;
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const rawValue = typeof body?.value === "string" ? body.value : "";

  if (!label || label.length > MAX_LABEL_LENGTH || rawValue.length > MAX_VALUE_LENGTH) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const value = sanitizeBlogHtml(rawValue);

  const ctx = buildArchiveContext(result.session, result.membership);
  const section = await getContentSection(ctx.companyId, ctx.tenantId, sectionId);
  if (!section) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const field = await createSectionTextField(ctx.companyId, ctx.tenantId, section.itemId, sectionId, label, value);

  return NextResponse.json({ ok: true, field }, { status: 201 });
}
