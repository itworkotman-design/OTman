import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

async function requireAdminMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return { error: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) } as const;
  }

  if (!session.activeCompanyId) {
    return {
      error: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    } as const;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      user: { select: { username: true, email: true } },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return { error: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) } as const;
  }

  return { session, membership } as const;
}

function parseOrderIds(body: unknown): string[] {
  const orderIds = (body as { orderIds?: unknown } | null)?.orderIds;

  return Array.isArray(orderIds)
    ? orderIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

// Manual GDPR hold: pauses the automatic 30-day anonymize / 6-month POD
// cleanup sweeps (lib/gdpr/runGdprCleanup.ts) for the selected orders, e.g.
// while a dispute, complaint, or unpaid-invoice review is open. A reason is
// required so the audit log records why data retention was extended.
export async function POST(req: Request) {
  const auth = await requireAdminMembership(req);
  if (auth.error) return auth.error;
  const { session, membership } = auth;

  const body = await req.json().catch(() => null);
  const orderIds = parseOrderIds(body);
  const reason = typeof (body as { reason?: unknown } | null)?.reason === "string"
    ? (body as { reason: string }).reason.trim()
    : "";

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json({ ok: false, reason: "HOLD_REASON_REQUIRED" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId: session.activeCompanyId! },
    select: { id: true, companyId: true },
  });

  const setAt = new Date();

  await prisma.order.updateMany({
    where: { id: { in: orders.map((order) => order.id) } },
    data: { gdprHold: true, gdprHoldReason: reason, gdprHoldSetAt: setAt },
  });

  await prisma.orderEvent.createMany({
    data: orders.map((order) => ({
      orderId: order.id,
      companyId: order.companyId,
      type: "GDPR_HOLD_SET" as const,
      actorMembershipId: membership.id,
      actorName: membership.user.username ?? null,
      actorEmail: membership.user.email,
      actorSource: "USER",
      payload: { reason },
      createdAt: setAt,
    })),
  });

  return NextResponse.json({ ok: true, heldCount: orders.length });
}

export async function DELETE(req: Request) {
  const auth = await requireAdminMembership(req);
  if (auth.error) return auth.error;
  const { session, membership } = auth;

  const body = await req.json().catch(() => null);
  const orderIds = parseOrderIds(body);

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId: session.activeCompanyId! },
    select: { id: true, companyId: true },
  });

  await prisma.order.updateMany({
    where: { id: { in: orders.map((order) => order.id) } },
    data: { gdprHold: false, gdprHoldReason: null, gdprHoldSetAt: null },
  });

  await prisma.orderEvent.createMany({
    data: orders.map((order) => ({
      orderId: order.id,
      companyId: order.companyId,
      type: "GDPR_HOLD_REMOVED" as const,
      actorMembershipId: membership.id,
      actorName: membership.user.username ?? null,
      actorEmail: membership.user.email,
      actorSource: "USER",
      payload: {},
    })),
  });

  return NextResponse.json({ ok: true, removedCount: orders.length });
}
