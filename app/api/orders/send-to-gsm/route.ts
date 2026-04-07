// path: app/api/orders/send-to-gsm/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { sendOrderToGsm } from "@/lib/integrations/gsm/sendOrder";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";

  if (!isAdminOrOwner) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }
 
  const body = await req.json().catch(() => null);
  const force = body?.force === true;

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_IDS" },
      { status: 400 },
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      companyId: session.activeCompanyId,
    },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "ORDERS_NOT_FOUND" },
      { status: 404 },
    );
  }

  const results: Array<{
    orderId: string;
    ok: boolean;
    gsmOrderId?: string;
    error?: string;
  }> = [];

  for (const order of orders) {
    try {
      //  Prevent duplicate sending
      if (order.gsmOrderId && !force) {
        results.push({
          orderId: order.id,
          ok: false,
          error: "ALREADY_SENT_TO_GSM",
        });
        continue;
      }

      const response = await sendOrderToGsm(order);

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            gsmOrderId: response.gsmOrderId,
            gsmExternalId: `order:${order.id}`,
            gsmSyncStatus: force ? "RESENT" : "SENT",
            gsmSentAt: new Date(),
            gsmLastSyncedAt: new Date(),
          },
        }),
        ...response.tasks.map((task) =>
          prisma.orderGsmTask.upsert({
            where: { gsmTaskId: task.gsmTaskId },
            update: {
              gsmOrderId: response.gsmOrderId,
              category: task.category,
              reference: task.reference,
              lastSyncedAt: new Date(),
            },
            create: {
              orderId: order.id,
              gsmTaskId: task.gsmTaskId,
              gsmOrderId: response.gsmOrderId,
              category: task.category,
              reference: task.reference,
              lastSyncedAt: new Date(),
            },
          }),
        ),
      ]);

      results.push({
        orderId: order.id,
        ok: true,
        gsmOrderId: response.gsmOrderId,
      });
    } catch (error) {
      results.push({
        orderId: order.id,
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    results,
  });
}
