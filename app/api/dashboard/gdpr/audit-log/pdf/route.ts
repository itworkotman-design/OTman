import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GDPR_AUDIT_EVENT_TYPES, parseAuditLogDateRange } from "@/lib/gdpr/auditEvents";
import { buildGdprAuditLogPdf } from "@/lib/gdpr/buildAuditLogPdf";

// GDPR audit trails are low-volume by nature (only anonymize/POD/hold
// events, not every order edit), so a single export doesn't need paging —
// this cap is just a safety net against an unbounded date range.
const PDF_EXPORT_LIMIT = 10_000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const { from, to } = parseAuditLogDateRange(new URL(req.url).searchParams);

  const company = await prisma.company.findUnique({
    where: { id: session.activeCompanyId },
    select: { name: true },
  });

  const events = await prisma.orderEvent.findMany({
    where: {
      companyId: session.activeCompanyId,
      type: { in: [...GDPR_AUDIT_EVENT_TYPES] },
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    select: {
      type: true,
      createdAt: true,
      actorName: true,
      actorEmail: true,
      actorSource: true,
      payload: true,
      order: { select: { displayId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: PDF_EXPORT_LIMIT,
  });

  const pdfBytes = await buildGdprAuditLogPdf({
    companyName: company?.name ?? "Company",
    from,
    to,
    events: events.map((event) => ({
      orderDisplayId: event.order.displayId,
      type: event.type,
      payload: event.payload,
      actor: event.actorSource === "USER" ? (event.actorName || event.actorEmail || "User") : "System",
      createdAt: event.createdAt,
    })),
  });

  const rangeSuffix = from || to ? `_${from ? isoDate(from) : "start"}_to_${to ? isoDate(to) : "now"}` : "";

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gdpr-audit-log${rangeSuffix}.pdf"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
