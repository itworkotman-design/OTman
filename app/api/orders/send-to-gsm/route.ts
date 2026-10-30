// path: app/api/orders/send-to-gsm/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { sendOrderToGsm } from "@/lib/integrations/gsm/sendOrder";
import { PICKUP_DOCUMENT_SOURCE } from "@/lib/orders/pickupDocuments";
import { sendReceiptsToGsmTask } from "@/lib/integrations/gsm/sendReceipts";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";

// Dashboard receipts are for the delivering driver, not the pick-up stop. A
// homepage order's store pickup documents (receipt / order confirmation) go on
// every task: the driver shows them to the cashier at pick-up and keeps them
// through drop-off.
function receiptGoesToTask(
  attachment: { category: string; source: string | null },
  taskCategory: string,
) {
  if (attachment.source === PICKUP_DOCUMENT_SOURCE) return true;
  return taskCategory === "drop_off" || taskCategory === "assignment";
}

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
  const activeCompanyId = session.activeCompanyId;

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          username: true,
          email: true,
        },
      },
    },
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
      companyId: activeCompanyId,
    },
    include: {
      items: true,
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
    orderNumber?: string;
    ok: boolean;
    gsmOrderId?: string;
    wasAlreadySent?: boolean;
    receiptsSent?: number;
    receiptError?: string;
    error?: string;
  }> = [];

  for (const order of orders) {
    try {
      const wasAlreadySent = !!order.gsmOrderId;

      const response = await sendOrderToGsm(order);

      const syncedAt = new Date();

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            lastEditedByMembershipId: membership.id,
            gsmOrderId: response.gsmOrderId,
            gsmExternalId: `order:${order.id}`,
            gsmSyncStatus: wasAlreadySent ? "RESENT" : "SENT",
            gsmSentAt: syncedAt,
            gsmLastSyncedAt: syncedAt,
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

      await createOrderActionEvent(prisma, {
        orderId: order.id,
        companyId: activeCompanyId,
        actor: {
          membershipId: membership.id,
          name: membership.user.username ?? null,
          email: membership.user.email,
          source: "USER",
        },
        title: wasAlreadySent ? "Order sent for GSM resend" : "Order sent for GSM",
        details: [`GSM order ID: ${response.gsmOrderId}`],
        createdAt: syncedAt,
      });

      // The order is already in GSM at this point, so a receipt failure is
      // reported on the result instead of failing the whole send.
      let receiptsSent: number | undefined;
      let receiptError: string | undefined;

      try {
        const attachments = await prisma.orderAttachment.findMany({
          where: {
            orderId: order.id,
            OR: [{ category: "RECEIPT" }, { source: PICKUP_DOCUMENT_SOURCE }],
          },
          select: { id: true, filename: true, mimeType: true, storagePath: true, category: true, source: true },
        });

        if (attachments.length > 0) {
          receiptsSent = 0;

          for (const task of response.tasks) {
            const receipts = attachments
              .filter((attachment) => receiptGoesToTask(attachment, task.category))
              .map(({ id, filename, mimeType, storagePath }) => ({ id, filename, mimeType, storagePath }));

            if (receipts.length === 0) continue;

            const sent = await sendReceiptsToGsmTask({
              gsmTaskId: task.gsmTaskId,
              receipts,
            });
            receiptsSent += sent.sent;
          }
        }
      } catch (error) {
        receiptError =
          error instanceof Error ? error.message : "RECEIPT_UPLOAD_FAILED";
      }

      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber ?? undefined,
        ok: true,
        gsmOrderId: response.gsmOrderId,
        wasAlreadySent,
        ...(receiptsSent !== undefined ? { receiptsSent } : {}),
        ...(receiptError ? { receiptError } : {}),
      });
    } catch (error) {
      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber ?? undefined,
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
