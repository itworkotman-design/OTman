import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSmsAdmin } from "@/lib/sms/smsAccess";
import { sendOrderSms } from "@/lib/sms/sendOrderSms";
import { buildSmsTemplateVariables, findMissingPlaceholders, renderOrderSms } from "@/lib/sms/templates";
import { ORDER_SMS_SELECT } from "@/lib/sms/orderSmsFields";

const MAX_ORDERS_PER_REQUEST = 200;

// Unlike send-selected-email (one summary email to one recipient), this texts
// each selected order's own customer, rendering the message's placeholders
// per order. Uses Phone, falling back to Phone 2. With `preview: true` it sends
// nothing and lists the orders where a placeholder the text uses is empty.
export async function POST(req: Request) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  const orderIds: string[] = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (orderIds.length === 0 || orderIds.length > MAX_ORDERS_PER_REQUEST) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, reason: "EMPTY_MESSAGE" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId: access.companyId },
    select: ORDER_SMS_SELECT,
    orderBy: { displayId: "asc" },
  });

  if (body?.preview === true) {
    const missing = orders.flatMap((order) => {
      const placeholders = findMissingPlaceholders(message, buildSmsTemplateVariables(order));
      return placeholders.length ? [{ orderId: order.id, displayId: order.displayId, placeholders }] : [];
    });
    return NextResponse.json({ ok: true, missing });
  }

  let sentCount = 0;
  const failed: Array<{ orderId: string; displayId: number; reason: string }> = [];

  for (const order of orders) {
    const result = await sendOrderSms({
      order: { id: order.id, companyId: order.companyId },
      toPhone: order.phone?.trim() || order.phoneTwo?.trim() || "",
      body: renderOrderSms(message, order),
      kind: "MANUAL",
      actor: access.actor,
    });

    if (result.ok) {
      sentCount += 1;
      continue;
    }
    if (result.reason === "SMS_NOT_CONFIGURED") {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 503 });
    }
    failed.push({ orderId: order.id, displayId: order.displayId, reason: result.reason });
  }

  return NextResponse.json({ ok: true, sentCount, failed });
}
