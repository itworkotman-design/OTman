import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
import { LIFECYCLE_EMAIL_KINDS, sendLifecycleEmailsForOrders, type LifecycleEmailKind } from "@/lib/orders/sendCustomerLifecycleEmail";

const VALID_KINDS = LIFECYCLE_EMAIL_KINDS;

export async function POST(req: Request) {
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
    select: {
      id: true,
      role: true,
      user: { select: { username: true, email: true } },
      permissions: { select: { permission: true } },
    },
  });

  if (!membership) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const permissions = membership.permissions.map((p): AppPermission => p.permission);

  if (!canEditOrders(membership.role, permissions)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const activeCompanyId = session.activeCompanyId;
  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const kind = typeof body?.kind === "string" ? body.kind : "";

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }

  if (!VALID_KINDS.includes(kind as LifecycleEmailKind)) {
    return NextResponse.json({ ok: false, reason: "INVALID_KIND" }, { status: 400 });
  }

  const normalizedKind = kind as LifecycleEmailKind;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId: activeCompanyId, isWebsiteOrder: true },
    select: {
      id: true,
      displayId: true,
      customerName: true,
      customerLabel: true,
      statusNotes: true,
      actionToken: true,
      email: true,
      paymentRequestSentAt: true,
      emailThreadToken: true,
    },
  });

  if (orders.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_ORDERS_FOUND" }, { status: 404 });
  }

  const missingToken = orders.filter((order) => !order.actionToken);
  if (missingToken.length > 0) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_ACTION_TOKEN", orderIds: missingToken.map((o) => o.id) },
      { status: 409 },
    );
  }

  const missingEmail = orders.filter((order) => !order.email);
  if (missingEmail.length > 0) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_CUSTOMER_EMAIL", orderIds: missingEmail.map((o) => o.id) },
      { status: 409 },
    );
  }

  const { sentCount, failedOrderIds } = await sendLifecycleEmailsForOrders({
    orders: orders.map((order) => ({ ...order, companyId: activeCompanyId })),
    kind: normalizedKind,
    actor: {
      membershipId: membership.id,
      name: membership.user.username ?? null,
      email: membership.user.email,
      source: "USER",
    },
  });

  return NextResponse.json({
    ok: failedOrderIds.length === 0,
    sentCount,
    failedCount: failedOrderIds.length,
  });
}
