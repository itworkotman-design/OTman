import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSmsAdmin } from "@/lib/sms/smsAccess";
import { isSmsConfigured } from "@/lib/sms/gatewayApi";
import { AUTOMATIC_SMS_TEMPLATE_DEFAULTS, SMS_TEMPLATE_PLACEHOLDERS, type AutomaticSmsKind } from "@/lib/sms/templates";

const TEMPLATE_SELECT = { id: true, kind: true, name: true, description: true, body: true, enabled: true, updatedAt: true } as const;

const AUTOMATIC_KINDS = Object.keys(AUTOMATIC_SMS_TEMPLATE_DEFAULTS) as AutomaticSmsKind[];

// Automatic templates are seeded switched off: nothing is texted to customers
// until an admin has read the text and turned it on. Concurrent GETs (React
// dev double-mount, two tabs) would otherwise both see a kind missing and both
// create it, so the check-and-create runs under a per-company advisory lock
// and re-reads the existing kinds once it holds it.
async function seedMissingAutomaticTemplates(companyId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sms-templates:${companyId}`}))`;

    const existing = await tx.smsTemplate.findMany({
      where: { companyId, kind: { in: AUTOMATIC_KINDS } },
      select: { kind: true },
    });
    const missing = AUTOMATIC_KINDS.filter((kind) => !existing.some((template) => template.kind === kind));
    if (missing.length === 0) return;

    await tx.smsTemplate.createMany({
      data: missing.map((kind) => ({
        companyId,
        kind,
        name: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].name,
        description: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].description,
        body: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].body,
        enabled: false,
      })),
    });
  });
}

function listTemplates(companyId: string) {
  return prisma.smsTemplate.findMany({
    where: { companyId },
    orderBy: [{ kind: "desc" }, { name: "asc" }],
    select: TEMPLATE_SELECT,
  });
}

export async function GET(req: Request) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  let templates = await listTemplates(access.companyId);

  if (AUTOMATIC_KINDS.some((kind) => !templates.some((template) => template.kind === kind))) {
    await seedMissingAutomaticTemplates(access.companyId);
    templates = await listTemplates(access.companyId);
  }

  return NextResponse.json({
    ok: true,
    configured: isSmsConfigured(),
    templates,
    placeholders: SMS_TEMPLATE_PLACEHOLDERS,
  });
}

export async function POST(req: Request) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;

  if (!name || !text) {
    return NextResponse.json({ ok: false, reason: "NAME_AND_BODY_REQUIRED" }, { status: 400 });
  }

  const template = await prisma.smsTemplate.create({
    data: { companyId: access.companyId, kind: "MANUAL", name, description, body: text },
  });

  return NextResponse.json({ ok: true, template });
}
