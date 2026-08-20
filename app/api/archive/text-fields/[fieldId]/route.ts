import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { deleteItemTextField, updateItemTextField } from "@/lib/docArchive/textFields";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

// See the matching comment in the section-scoped POST route — label is
// optional rich-text now, capped the same as titles.ts's MAX_TITLE_LENGTH.
const MAX_LABEL_LENGTH = 2000;
const MAX_VALUE_LENGTH = 20000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fieldId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fieldId } = await params;
  const body = await req.json().catch(() => null);

  const data: { label?: string; value?: string } = {};

  if (body?.label !== undefined) {
    const rawLabel = typeof body.label === "string" ? body.label : "";
    if (rawLabel.length > MAX_LABEL_LENGTH) {
      return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
    }
    data.label = sanitizeBlogHtml(rawLabel);
  }

  if (body?.value !== undefined) {
    const rawValue = typeof body.value === "string" ? body.value : "";
    if (rawValue.length > MAX_VALUE_LENGTH) {
      return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
    }
    data.value = sanitizeBlogHtml(rawValue);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const updateResult = await updateItemTextField(ctx.companyId, ctx.tenantId, fieldId, data);

  if (!updateResult.ok) {
    return NextResponse.json({ ok: false, reason: updateResult.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true, field: updateResult.field });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fieldId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { fieldId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const deleteResult = await deleteItemTextField(ctx.companyId, ctx.tenantId, fieldId);

  if (!deleteResult.ok) {
    return NextResponse.json({ ok: false, reason: deleteResult.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
