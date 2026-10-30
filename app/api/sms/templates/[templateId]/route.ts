import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSmsAdmin } from "@/lib/sms/smsAccess";

type TemplateRouteParams = {
  params: Promise<{ templateId: string }>;
};

async function findTemplate(templateId: string, companyId: string) {
  return prisma.smsTemplate.findFirst({
    where: { id: templateId, companyId },
    select: { id: true, kind: true },
  });
}

// `kind` is deliberately not editable: there is exactly one template per
// automatic kind per company, created by GET /api/sms/templates.
export async function PATCH(req: Request, { params }: TemplateRouteParams) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const { templateId } = await params;
  const template = await findTemplate(templateId, access.companyId);
  if (!template) {
    return NextResponse.json({ ok: false, reason: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  // The automatic templates keep their built-in name and description; only
  // their text and on/off switch are editable.
  if (template.kind !== "MANUAL" && (body?.name !== undefined || body?.description !== undefined)) {
    return NextResponse.json({ ok: false, reason: "AUTOMATIC_TEMPLATE_DETAILS_LOCKED" }, { status: 400 });
  }

  const data: { enabled?: boolean; body?: string; name?: string; description?: string | null } = {};

  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;
  if (body?.body !== undefined) {
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return NextResponse.json({ ok: false, reason: "BODY_REQUIRED" }, { status: 400 });
    data.body = text;
  }
  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, reason: "NAME_REQUIRED" }, { status: 400 });
    data.name = name;
  }
  // Optional; blank clears it.
  if (body?.description !== undefined) {
    data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }

  const updated = await prisma.smsTemplate.update({ where: { id: template.id }, data });
  return NextResponse.json({ ok: true, template: updated });
}

export async function DELETE(req: Request, { params }: TemplateRouteParams) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const { templateId } = await params;
  const template = await findTemplate(templateId, access.companyId);
  if (!template) {
    return NextResponse.json({ ok: false, reason: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }
  if (template.kind !== "MANUAL") {
    return NextResponse.json({ ok: false, reason: "CANNOT_DELETE_AUTOMATIC_TEMPLATE" }, { status: 400 });
  }

  await prisma.smsTemplate.delete({ where: { id: template.id } });
  return NextResponse.json({ ok: true });
}
