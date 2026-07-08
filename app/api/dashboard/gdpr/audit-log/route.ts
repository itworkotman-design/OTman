import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GDPR_AUDIT_EVENT_TYPES, parseAuditLogDateRange } from "@/lib/gdpr/auditEvents";

const AUDIT_LOG_LIMIT = 200;

// Collapsible GDPR audit log on the dashboard home page. `payload` on these
// events only ever holds field *names* and metadata (see
// lib/gdpr/runGdprCleanup.ts and app/api/orders/gdpr/hold/route.ts) — never
// the anonymized values themselves, so it's safe to return as-is.
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

  const events = await prisma.orderEvent.findMany({
    where: {
      companyId: session.activeCompanyId,
      type: { in: [...GDPR_AUDIT_EVENT_TYPES] },
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    select: {
      id: true,
      type: true,
      createdAt: true,
      actorName: true,
      actorEmail: true,
      actorSource: true,
      payload: true,
      order: {
        select: { displayId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: AUDIT_LOG_LIMIT,
  });

  return NextResponse.json({
    ok: true,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      orderDisplayId: event.order.displayId,
      actor: event.actorSource === "USER" ? (event.actorName || event.actorEmail || "User") : "System",
      payload: event.payload,
    })),
  });
}
